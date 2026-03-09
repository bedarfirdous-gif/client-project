"""
Learning Engine
===============
Feedback loop system that learns from successful and failed fixes
to improve auto-fix confidence over time.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LearningEngine")


class FixOutcome(Enum):
    """Outcome of a fix attempt"""
    SUCCESS = "success"           # Fix worked
    PARTIAL_SUCCESS = "partial"   # Fix helped but didn't fully resolve
    FAILURE = "failure"           # Fix didn't work
    REGRESSION = "regression"     # Fix made things worse
    REVERTED = "reverted"         # Fix was rolled back


class ConfidenceLevel(Enum):
    """Confidence level for fix patterns"""
    VERY_LOW = "very_low"     # 0-20%
    LOW = "low"               # 20-40%
    MEDIUM = "medium"         # 40-60%
    HIGH = "high"             # 60-80%
    VERY_HIGH = "very_high"   # 80-100%


@dataclass
class FixConfidence:
    """
    Confidence score for a fix pattern.
    """
    pattern_id: str = ""
    error_fingerprint_id: str = ""
    fix_type: str = ""
    confidence_score: float = 0.5  # 0.0 to 1.0
    confidence_level: ConfidenceLevel = ConfidenceLevel.MEDIUM
    
    # Stats
    total_attempts: int = 0
    successful_attempts: int = 0
    failed_attempts: int = 0
    regression_count: int = 0
    
    # Time-based metrics
    avg_fix_time_seconds: float = 0.0
    last_success_at: Optional[str] = None
    last_failure_at: Optional[str] = None
    
    # Learning
    is_reliable: bool = False  # True if high confidence with enough samples
    needs_review: bool = False  # True if confidence is declining
    
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class PatternMatch:
    """
    A match between an error and a known fix pattern.
    """
    match_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    error_id: str = ""
    error_fingerprint_id: str = ""
    pattern_id: str = ""
    fix_type: str = ""
    
    # Match quality
    match_score: float = 0.0  # 0.0 to 1.0
    match_method: str = ""    # exact, fuzzy, semantic
    
    # Fix details
    suggested_fix: Optional[str] = None
    fix_confidence: float = 0.0
    
    # Status
    applied: bool = False
    outcome: Optional[FixOutcome] = None
    
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class LearningEvent:
    """
    A learning event from a fix attempt.
    """
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    error_id: str = ""
    error_fingerprint_id: str = ""
    pattern_id: str = ""
    fix_type: str = ""
    
    # Outcome
    outcome: FixOutcome = FixOutcome.SUCCESS
    fix_time_seconds: float = 0.0
    
    # Context
    error_context: Optional[Dict] = None
    fix_context: Optional[Dict] = None
    
    # Feedback
    user_feedback: Optional[str] = None
    agent_feedback: Optional[str] = None
    
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LearningEngine:
    """
    Engine that learns from fix outcomes to improve confidence.
    
    Features:
    - Track success/failure of fixes
    - Adjust confidence scores based on outcomes
    - Identify reliable patterns
    - Flag declining patterns for review
    - Generate fix suggestions based on learning
    """
    
    def __init__(self, db=None):
        self.db = db
        self.confidence_cache: Dict[str, FixConfidence] = {}
        self.learning_events: List[LearningEvent] = []
        self.matches: List[PatternMatch] = []
        
        # Confidence adjustment parameters
        self.success_boost = 0.05       # Increase per success
        self.failure_penalty = 0.10     # Decrease per failure
        self.regression_penalty = 0.20  # Large decrease for regressions
        self.min_confidence = 0.05      # Minimum confidence
        self.max_confidence = 0.95      # Maximum confidence
        self.reliability_threshold = 0.7  # Min confidence for "reliable"
        self.min_samples_for_reliability = 5  # Min attempts for reliability
        
        # Collections
        if db is not None:
            self.confidence_collection = db.fix_confidence
            self.events_collection = db.learning_events
            self.matches_collection = db.pattern_matches
        
        logger.info("LearningEngine initialized")
    
    async def init_indexes(self):
        """Initialize database indexes"""
        if self.db is None:
            return
        
        await self.confidence_collection.create_index([("pattern_id", 1)])
        await self.confidence_collection.create_index([("error_fingerprint_id", 1)])
        await self.confidence_collection.create_index([("confidence_score", -1)])
        await self.events_collection.create_index([("timestamp", -1)])
        await self.events_collection.create_index([("pattern_id", 1)])
        await self.matches_collection.create_index([("error_id", 1)])
    
    def _calculate_confidence_level(self, score: float) -> ConfidenceLevel:
        """Convert score to confidence level"""
        if score < 0.2:
            return ConfidenceLevel.VERY_LOW
        elif score < 0.4:
            return ConfidenceLevel.LOW
        elif score < 0.6:
            return ConfidenceLevel.MEDIUM
        elif score < 0.8:
            return ConfidenceLevel.HIGH
        else:
            return ConfidenceLevel.VERY_HIGH
    
    async def record_fix_outcome(
        self,
        error_id: str,
        error_fingerprint_id: str,
        pattern_id: str,
        fix_type: str,
        outcome: FixOutcome,
        fix_time_seconds: float = 0.0,
        error_context: Optional[Dict] = None,
        fix_context: Optional[Dict] = None,
        user_feedback: Optional[str] = None,
        agent_feedback: Optional[str] = None
    ) -> FixConfidence:
        """
        Record the outcome of a fix attempt and update confidence.
        """
        # Create learning event
        event = LearningEvent(
            error_id=error_id,
            error_fingerprint_id=error_fingerprint_id,
            pattern_id=pattern_id,
            fix_type=fix_type,
            outcome=outcome,
            fix_time_seconds=fix_time_seconds,
            error_context=error_context,
            fix_context=fix_context,
            user_feedback=user_feedback,
            agent_feedback=agent_feedback
        )
        
        self.learning_events.append(event)
        
        if self.db is not None:
            await self.events_collection.insert_one({
                "event_id": event.event_id,
                "error_id": event.error_id,
                "error_fingerprint_id": event.error_fingerprint_id,
                "pattern_id": event.pattern_id,
                "fix_type": event.fix_type,
                "outcome": event.outcome.value,
                "fix_time_seconds": event.fix_time_seconds,
                "error_context": event.error_context,
                "fix_context": event.fix_context,
                "user_feedback": event.user_feedback,
                "agent_feedback": event.agent_feedback,
                "timestamp": event.timestamp
            })
        
        # Get or create confidence record
        confidence = await self._get_or_create_confidence(
            pattern_id, error_fingerprint_id, fix_type
        )
        
        # Update stats
        confidence.total_attempts += 1
        
        if outcome == FixOutcome.SUCCESS:
            confidence.successful_attempts += 1
            confidence.last_success_at = datetime.now(timezone.utc).isoformat()
            confidence.confidence_score = min(
                confidence.confidence_score + self.success_boost,
                self.max_confidence
            )
        elif outcome == FixOutcome.PARTIAL_SUCCESS:
            confidence.successful_attempts += 1
            confidence.confidence_score += self.success_boost / 2
        elif outcome == FixOutcome.FAILURE:
            confidence.failed_attempts += 1
            confidence.last_failure_at = datetime.now(timezone.utc).isoformat()
            confidence.confidence_score = max(
                confidence.confidence_score - self.failure_penalty,
                self.min_confidence
            )
        elif outcome == FixOutcome.REGRESSION:
            confidence.failed_attempts += 1
            confidence.regression_count += 1
            confidence.confidence_score = max(
                confidence.confidence_score - self.regression_penalty,
                self.min_confidence
            )
        elif outcome == FixOutcome.REVERTED:
            confidence.failed_attempts += 1
            confidence.confidence_score = max(
                confidence.confidence_score - self.failure_penalty,
                self.min_confidence
            )
        
        # Update average fix time
        if fix_time_seconds > 0:
            old_avg = confidence.avg_fix_time_seconds
            n = confidence.total_attempts
            confidence.avg_fix_time_seconds = old_avg + (fix_time_seconds - old_avg) / n
        
        # Update reliability status
        confidence.is_reliable = (
            confidence.confidence_score >= self.reliability_threshold and
            confidence.total_attempts >= self.min_samples_for_reliability and
            confidence.regression_count == 0
        )
        
        # Check if needs review (confidence declining)
        if confidence.total_attempts >= 3:
            success_rate = confidence.successful_attempts / confidence.total_attempts
            if success_rate < 0.5 and confidence.total_attempts >= 5:
                confidence.needs_review = True
        
        confidence.confidence_level = self._calculate_confidence_level(confidence.confidence_score)
        confidence.updated_at = datetime.now(timezone.utc).isoformat()
        
        # Save updated confidence
        await self._save_confidence(confidence)
        
        # Update cache
        cache_key = f"{pattern_id}:{error_fingerprint_id}"
        self.confidence_cache[cache_key] = confidence
        
        logger.info(
            f"[Learning] Recorded {outcome.value} for pattern {pattern_id[:8]} - "
            f"Confidence: {confidence.confidence_score:.2f} ({confidence.confidence_level.value})"
        )
        
        return confidence
    
    async def _get_or_create_confidence(
        self,
        pattern_id: str,
        error_fingerprint_id: str,
        fix_type: str
    ) -> FixConfidence:
        """Get existing or create new confidence record"""
        cache_key = f"{pattern_id}:{error_fingerprint_id}"
        
        # Check cache
        if cache_key in self.confidence_cache:
            return self.confidence_cache[cache_key]
        
        # Check database
        if self.db is not None:
            doc = await self.confidence_collection.find_one({
                "pattern_id": pattern_id,
                "error_fingerprint_id": error_fingerprint_id
            })
            
            if doc:
                doc.pop("_id", None)
                confidence = FixConfidence(
                    pattern_id=doc["pattern_id"],
                    error_fingerprint_id=doc["error_fingerprint_id"],
                    fix_type=doc.get("fix_type", ""),
                    confidence_score=doc.get("confidence_score", 0.5),
                    confidence_level=ConfidenceLevel(doc.get("confidence_level", "medium")),
                    total_attempts=doc.get("total_attempts", 0),
                    successful_attempts=doc.get("successful_attempts", 0),
                    failed_attempts=doc.get("failed_attempts", 0),
                    regression_count=doc.get("regression_count", 0),
                    avg_fix_time_seconds=doc.get("avg_fix_time_seconds", 0.0),
                    last_success_at=doc.get("last_success_at"),
                    last_failure_at=doc.get("last_failure_at"),
                    is_reliable=doc.get("is_reliable", False),
                    needs_review=doc.get("needs_review", False),
                    created_at=doc.get("created_at"),
                    updated_at=doc.get("updated_at")
                )
                self.confidence_cache[cache_key] = confidence
                return confidence
        
        # Create new
        confidence = FixConfidence(
            pattern_id=pattern_id,
            error_fingerprint_id=error_fingerprint_id,
            fix_type=fix_type,
            confidence_score=0.5,  # Start at neutral
            confidence_level=ConfidenceLevel.MEDIUM
        )
        
        self.confidence_cache[cache_key] = confidence
        return confidence
    
    async def _save_confidence(self, confidence: FixConfidence):
        """Save confidence to database"""
        if self.db is None:
            return
        
        doc = {
            "pattern_id": confidence.pattern_id,
            "error_fingerprint_id": confidence.error_fingerprint_id,
            "fix_type": confidence.fix_type,
            "confidence_score": confidence.confidence_score,
            "confidence_level": confidence.confidence_level.value,
            "total_attempts": confidence.total_attempts,
            "successful_attempts": confidence.successful_attempts,
            "failed_attempts": confidence.failed_attempts,
            "regression_count": confidence.regression_count,
            "avg_fix_time_seconds": confidence.avg_fix_time_seconds,
            "last_success_at": confidence.last_success_at,
            "last_failure_at": confidence.last_failure_at,
            "is_reliable": confidence.is_reliable,
            "needs_review": confidence.needs_review,
            "created_at": confidence.created_at,
            "updated_at": confidence.updated_at
        }
        
        await self.confidence_collection.replace_one(
            {
                "pattern_id": confidence.pattern_id,
                "error_fingerprint_id": confidence.error_fingerprint_id
            },
            doc,
            upsert=True
        )
    
    async def get_fix_confidence(
        self,
        pattern_id: str,
        error_fingerprint_id: str
    ) -> Optional[FixConfidence]:
        """Get confidence for a pattern"""
        return await self._get_or_create_confidence(
            pattern_id, error_fingerprint_id, ""
        )
    
    async def should_auto_fix(
        self,
        pattern_id: str,
        error_fingerprint_id: str,
        min_confidence: float = 0.6
    ) -> Tuple[bool, float, str]:
        """
        Determine if auto-fix should be attempted based on confidence.
        
        Returns:
            (should_fix, confidence_score, reason)
        """
        confidence = await self._get_or_create_confidence(
            pattern_id, error_fingerprint_id, ""
        )
        
        if confidence.total_attempts == 0:
            return True, 0.5, "New pattern - allowing first attempt"
        
        if confidence.regression_count > 0:
            return False, confidence.confidence_score, "Pattern has caused regressions"
        
        if confidence.needs_review:
            return False, confidence.confidence_score, "Pattern needs manual review"
        
        if confidence.confidence_score >= min_confidence:
            return True, confidence.confidence_score, f"Confidence {confidence.confidence_score:.2f} meets threshold"
        
        return False, confidence.confidence_score, f"Confidence {confidence.confidence_score:.2f} below threshold {min_confidence}"
    
    async def get_reliable_patterns(self) -> List[Dict]:
        """Get patterns that are reliable for auto-fix"""
        if self.db is None:
            return [
                {
                    "pattern_id": c.pattern_id,
                    "confidence_score": c.confidence_score,
                    "total_attempts": c.total_attempts,
                    "successful_attempts": c.successful_attempts
                }
                for c in self.confidence_cache.values()
                if c.is_reliable
            ]
        
        cursor = self.confidence_collection.find(
            {"is_reliable": True},
            {"_id": 0}
        ).sort("confidence_score", -1)
        
        return await cursor.to_list(100)
    
    async def get_patterns_needing_review(self) -> List[Dict]:
        """Get patterns that need human review"""
        if self.db is None:
            return [
                {
                    "pattern_id": c.pattern_id,
                    "confidence_score": c.confidence_score,
                    "total_attempts": c.total_attempts,
                    "failed_attempts": c.failed_attempts
                }
                for c in self.confidence_cache.values()
                if c.needs_review
            ]
        
        cursor = self.confidence_collection.find(
            {"needs_review": True},
            {"_id": 0}
        ).sort("failed_attempts", -1)
        
        return await cursor.to_list(100)
    
    async def get_learning_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get learning statistics for dashboard"""
        if self.db is None:
            return {
                "total_patterns": len(self.confidence_cache),
                "reliable_patterns": len([c for c in self.confidence_cache.values() if c.is_reliable]),
                "needs_review": len([c for c in self.confidence_cache.values() if c.needs_review]),
                "total_events": len(self.learning_events)
            }
        
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        # Get counts
        total_patterns = await self.confidence_collection.count_documents({})
        reliable = await self.confidence_collection.count_documents({"is_reliable": True})
        needs_review = await self.confidence_collection.count_documents({"needs_review": True})
        
        # Get recent events
        events_pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {
                "_id": "$outcome",
                "count": {"$sum": 1}
            }}
        ]
        
        events_result = await self.events_collection.aggregate(events_pipeline).to_list(10)
        events_by_outcome = {r["_id"]: r["count"] for r in events_result}
        
        total_events = sum(events_by_outcome.values())
        successes = events_by_outcome.get("success", 0) + events_by_outcome.get("partial", 0)
        
        return {
            "total_patterns": total_patterns,
            "reliable_patterns": reliable,
            "patterns_needing_review": needs_review,
            "total_events_24h": total_events,
            "success_rate_24h": round((successes / max(total_events, 1)) * 100, 1),
            "events_by_outcome": events_by_outcome,
            "avg_confidence": await self._get_avg_confidence()
        }
    
    async def _get_avg_confidence(self) -> float:
        """Get average confidence across all patterns"""
        if self.db is None:
            if not self.confidence_cache:
                return 0.5
            return sum(c.confidence_score for c in self.confidence_cache.values()) / len(self.confidence_cache)
        
        pipeline = [
            {"$group": {"_id": None, "avg": {"$avg": "$confidence_score"}}}
        ]
        
        result = await self.confidence_collection.aggregate(pipeline).to_list(1)
        return round(result[0]["avg"], 2) if result else 0.5
    
    async def teach_pattern(
        self,
        error_fingerprint_id: str,
        fix_type: str,
        fix_description: str,
        initial_confidence: float = 0.7
    ) -> FixConfidence:
        """
        Manually teach a new pattern with initial confidence.
        Used for known good fixes that should have high confidence.
        """
        pattern_id = hashlib.md5(
            f"{error_fingerprint_id}:{fix_type}".encode()
        ).hexdigest()
        
        confidence = FixConfidence(
            pattern_id=pattern_id,
            error_fingerprint_id=error_fingerprint_id,
            fix_type=fix_type,
            confidence_score=min(initial_confidence, 0.9),  # Cap at 90%
            confidence_level=self._calculate_confidence_level(initial_confidence),
            total_attempts=1,
            successful_attempts=1,
            is_reliable=initial_confidence >= self.reliability_threshold
        )
        
        await self._save_confidence(confidence)
        
        cache_key = f"{pattern_id}:{error_fingerprint_id}"
        self.confidence_cache[cache_key] = confidence
        
        logger.info(f"[Learning] Taught new pattern: {pattern_id[:8]} with confidence {initial_confidence}")
        
        return confidence
