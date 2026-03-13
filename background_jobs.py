"""
Background Jobs for BijnisBooks

This module contains background tasks that run periodically:
1. Auto-delete expired recycle bin items (30 days)
2. Clean up old sessions
3. Health checks
"""

import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging

logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "bijnisbooks")


class RecycleBinAutoDelete:
    """Auto-delete expired items from recycle bin after 30 days"""
    
    def __init__(self, db):
        self.db = db
        self.is_running = False
        self.check_interval = 3600  # Check every hour
        
    async def cleanup_expired_items(self):
        """Delete items that have passed their auto_delete_at date"""
        now = datetime.now(timezone.utc).isoformat()
        
        try:
            # Find expired items
            expired_items = await self.db.recycle_bin.find({
                "is_permanently_deleted": False,
                "auto_delete_at": {"$lte": now}
            }, {"_id": 0}).to_list(100)
            
            if not expired_items:
                logger.info("No expired recycle bin items to delete")
                return {"deleted": 0}
            
            deleted_count = 0
            
            for item in expired_items:
                try:
                    # Permanently delete based on item type
                    if item["item_type"] == "employee":
                        await self.db.employees.delete_one({
                            "id": item["original_id"], 
                            "tenant_id": item["tenant_id"]
                        })
                    elif item["item_type"] == "customer":
                        await self.db.customers.delete_one({
                            "id": item["original_id"], 
                            "tenant_id": item["tenant_id"]
                        })
                    elif item["item_type"] == "item":
                        await self.db.items.delete_one({
                            "id": item["original_id"], 
                            "tenant_id": item["tenant_id"]
                        })
                        await self.db.variants.delete_many({"item_id": item["original_id"]})
                        await self.db.inventory.delete_many({"item_id": item["original_id"]})
                    elif item["item_type"] == "invoice":
                        await self.db.invoices.delete_one({
                            "id": item["original_id"], 
                            "tenant_id": item["tenant_id"]
                        })
                    elif item["item_type"] == "purchase":
                        await self.db.purchase_invoices.delete_one({
                            "id": item["original_id"], 
                            "tenant_id": item["tenant_id"]
                        })
                    
                    # Mark as permanently deleted
                    await self.db.recycle_bin.update_one(
                        {"id": item["id"]},
                        {"$set": {
                            "is_permanently_deleted": True,
                            "permanently_deleted_at": datetime.now(timezone.utc).isoformat(),
                            "auto_deleted": True,
                            "auto_deleted_reason": "30-day retention period expired"
                        }}
                    )
                    
                    deleted_count += 1
                    logger.info(f"Auto-deleted {item['item_type']} {item['original_id']} from tenant {item['tenant_id']}")
                    
                except Exception as e:
                    logger.error(f"Error auto-deleting item {item['id']}: {e}")
            
            logger.info(f"Auto-delete completed: {deleted_count} items permanently deleted")
            return {"deleted": deleted_count}
            
        except Exception as e:
            logger.error(f"Error in cleanup_expired_items: {e}")
            return {"deleted": 0, "error": str(e)}
    
    async def run_cleanup_loop(self):
        """Run the cleanup task periodically"""
        self.is_running = True
        logger.info("Starting recycle bin auto-delete background job")
        
        while self.is_running:
            try:
                result = await self.cleanup_expired_items()
                logger.info(f"Auto-delete job result: {result}")
            except Exception as e:
                logger.error(f"Error in auto-delete loop: {e}")
            
            # Sleep until next check
            await asyncio.sleep(self.check_interval)
    
    def stop(self):
        """Stop the cleanup loop"""
        self.is_running = False
        logger.info("Stopping recycle bin auto-delete background job")


# Global instance
_auto_delete_job = None


async def start_auto_delete_job(db):
    """Start the auto-delete background job"""
    global _auto_delete_job
    
    if _auto_delete_job is None:
        _auto_delete_job = RecycleBinAutoDelete(db)
        asyncio.create_task(_auto_delete_job.run_cleanup_loop())
        logger.info("Auto-delete background job started")
    
    return _auto_delete_job


async def stop_auto_delete_job():
    """Stop the auto-delete background job"""
    global _auto_delete_job
    
    if _auto_delete_job:
        _auto_delete_job.stop()
        _auto_delete_job = None
        logger.info("Auto-delete background job stopped")


async def run_cleanup_now(db):
    """Manually trigger cleanup (for testing or admin use)"""
    job = RecycleBinAutoDelete(db)
    return await job.cleanup_expired_items()


def get_auto_delete_status():
    """Get status of the auto-delete job"""
    global _auto_delete_job
    
    if _auto_delete_job:
        return {
            "running": _auto_delete_job.is_running,
            "check_interval": _auto_delete_job.check_interval
        }
    return {"running": False}


# =============================================
# BLOG POST SCHEDULER
# =============================================

class BlogPostScheduler:
    """Auto-publish scheduled blog posts when their scheduled time arrives"""
    
    def __init__(self, db):
        self.db = db
        self.is_running = False
        self.check_interval = 60  # Check every minute for scheduled posts
        
    async def publish_scheduled_posts(self):
        """Publish posts that have reached their scheduled_at time"""
        now = datetime.now(timezone.utc).isoformat()
        
        try:
            # Find scheduled posts that are due
            scheduled_posts = await self.db.blog_posts.find({
                "status": "scheduled",
                "scheduled_at": {"$lte": now},
                "is_deleted": {"$ne": True}
            }, {"_id": 0}).to_list(100)
            
            if not scheduled_posts:
                return {"published": 0}
            
            published_count = 0
            
            for post in scheduled_posts:
                try:
                    # Update post status to published
                    await self.db.blog_posts.update_one(
                        {"id": post["id"]},
                        {"$set": {
                            "status": "published",
                            "published_at": now,
                            "updated_at": now
                        }}
                    )
                    
                    published_count += 1
                    logger.info(f"Auto-published scheduled blog post: {post['id']} - {post['title']}")
                    
                except Exception as e:
                    logger.error(f"Error publishing scheduled post {post['id']}: {e}")
            
            if published_count > 0:
                logger.info(f"Blog scheduler: Published {published_count} scheduled posts")
            return {"published": published_count}
            
        except Exception as e:
            logger.error(f"Error in publish_scheduled_posts: {e}")
            return {"published": 0, "error": str(e)}
    
    async def run_scheduler_loop(self):
        """Run the scheduler task periodically"""
        self.is_running = True
        logger.info("Starting blog post scheduler background job")
        
        while self.is_running:
            try:
                result = await self.publish_scheduled_posts()
                if result.get("published", 0) > 0:
                    logger.info(f"Blog scheduler result: {result}")
            except Exception as e:
                logger.error(f"Error in blog scheduler loop: {e}")
            
            # Sleep until next check
            await asyncio.sleep(self.check_interval)
    
    def stop(self):
        """Stop the scheduler loop"""
        self.is_running = False
        logger.info("Stopping blog post scheduler background job")


# Global instance for blog scheduler
_blog_scheduler = None


async def start_blog_scheduler(db):
    """Start the blog post scheduler background job"""
    global _blog_scheduler
    
    if _blog_scheduler is None:
        _blog_scheduler = BlogPostScheduler(db)
        asyncio.create_task(_blog_scheduler.run_scheduler_loop())
        logger.info("Blog post scheduler started")
    
    return _blog_scheduler


async def stop_blog_scheduler():
    """Stop the blog post scheduler background job"""
    global _blog_scheduler
    
    if _blog_scheduler:
        _blog_scheduler.stop()
        _blog_scheduler = None
        logger.info("Blog post scheduler stopped")


def get_blog_scheduler_status():
    """Get status of the blog scheduler"""
    global _blog_scheduler
    
    if _blog_scheduler:
        return {
            "running": _blog_scheduler.is_running,
            "check_interval": _blog_scheduler.check_interval
        }
    return {"running": False}
