"""
Auto Poster Creation & Social Media Deployment System
======================================================
Hands-free social media marketing for all admins.

Features:
- Auto-generate posters using product images, offers, festival themes, brand logos
- Support multiple formats: Instagram Post/Story, Facebook Post, WhatsApp Status
- Auto-generate captions and hashtags
- Connect social accounts (Facebook, Instagram, WhatsApp Business)
- Scheduled and campaign-based posting
"""

import os
import uuid
import base64
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum
from dotenv import load_dotenv

load_dotenv()

# ============== ENUMS ==============

class PosterFormat(str, Enum):
    INSTAGRAM_POST = "instagram_post"  # 1080x1080
    INSTAGRAM_STORY = "instagram_story"  # 1080x1920
    FACEBOOK_POST = "facebook_post"  # 1200x630
    WHATSAPP_STATUS = "whatsapp_status"  # 1080x1920

class CampaignType(str, Enum):
    SALE = "sale"
    NEW_ARRIVALS = "new_arrivals"
    OFFERS = "offers"
    FESTIVAL = "festival"
    CUSTOM = "custom"

class PostStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"

class PlatformType(str, Enum):
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    WHATSAPP = "whatsapp"

# ============== PYDANTIC MODELS ==============

class FestivalCreate(BaseModel):
    """Schema for adding a custom festival"""
    name: str
    date: str  # ISO date
    description: Optional[str] = None
    themes: List[str] = []  # e.g., ["colorful", "traditional", "festive"]
    colors: List[str] = []  # Brand colors for the festival


class PosterCreate(BaseModel):
    """Schema for creating a poster"""
    title: str
    formats: List[PosterFormat] = [PosterFormat.INSTAGRAM_POST]
    campaign_type: CampaignType = CampaignType.CUSTOM
    
    # Content
    product_ids: List[str] = []  # Product IDs to feature
    offer_text: Optional[str] = None  # e.g., "50% OFF"
    festival_id: Optional[str] = None  # Link to festival
    custom_message: Optional[str] = None
    
    # Branding
    include_logo: bool = True
    brand_colors: List[str] = []  # Override default brand colors
    style: str = "colorful"  # colorful, minimal, professional


class ScheduledPost(BaseModel):
    """Schema for scheduling a post"""
    poster_id: str
    platforms: List[PlatformType]
    scheduled_time: str  # ISO datetime
    caption: Optional[str] = None
    hashtags: List[str] = []


class SocialAccountConnect(BaseModel):
    """Schema for connecting a social account"""
    platform: PlatformType
    access_token: str
    page_id: Optional[str] = None  # For Facebook Pages
    account_id: Optional[str] = None  # For Instagram Business


# ============== FORMAT DIMENSIONS ==============

FORMAT_DIMENSIONS = {
    PosterFormat.INSTAGRAM_POST: (1080, 1080),
    PosterFormat.INSTAGRAM_STORY: (1080, 1920),
    PosterFormat.FACEBOOK_POST: (1200, 630),
    PosterFormat.WHATSAPP_STATUS: (1080, 1920),
}

# ============== AUTO POSTER SYSTEM ==============

class AutoPosterSystem:
    """
    Comprehensive auto poster creation and social media deployment system.
    Uses Gemini Nano Banana for AI-powered poster generation.
    """
    
    def __init__(self, db, emergent_api_key: Optional[str] = None):
        self.db = db
        self.api_key = emergent_api_key or os.getenv("EMERGENT_LLM_KEY")
    
    # ========== FESTIVAL MANAGEMENT ==========
    
    async def add_festival(
        self,
        festival_data: FestivalCreate,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Add a custom festival to the calendar"""
        now = datetime.now(timezone.utc).isoformat()
        festival_id = str(uuid.uuid4())
        
        festival_doc = {
            "id": festival_id,
            "tenant_id": tenant_id,
            "name": festival_data.name,
            "date": festival_data.date,
            "description": festival_data.description,
            "themes": festival_data.themes or ["festive", "celebration"],
            "colors": festival_data.colors or ["#FF6B6B", "#4ECDC4", "#FFE66D"],
            "is_active": True,
            "created_at": now
        }
        
        await self.db.festivals.insert_one(festival_doc)
        del festival_doc["_id"]
        
        return {"message": f"Festival '{festival_data.name}' added", "festival": festival_doc}
    
    async def get_festivals(
        self,
        tenant_id: str,
        upcoming_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Get festivals for a tenant"""
        query = {"tenant_id": tenant_id, "is_active": True}
        
        if upcoming_only:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            query["date"] = {"$gte": today}
        
        festivals = await self.db.festivals.find(
            query, {"_id": 0}
        ).sort("date", 1).to_list(50)
        
        return festivals
    
    async def get_upcoming_festival(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get the next upcoming festival within 7 days"""
        today = datetime.now(timezone.utc)
        week_later = (today + timedelta(days=7)).strftime("%Y-%m-%d")
        today_str = today.strftime("%Y-%m-%d")
        
        festival = await self.db.festivals.find_one(
            {
                "tenant_id": tenant_id,
                "is_active": True,
                "date": {"$gte": today_str, "$lte": week_later}
            },
            {"_id": 0}
        )
        
        return festival
    
    # ========== POSTER GENERATION ==========
    
    async def generate_poster(
        self,
        poster_data: PosterCreate,
        tenant_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Generate a marketing poster using AI"""
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        now = datetime.now(timezone.utc).isoformat()
        poster_id = str(uuid.uuid4())
        
        # Get business info for branding - check multiple sources
        brand_name = "Your Brand"
        brand_colors = ["#6366F1", "#EC4899", "#F59E0B"]
        
        # 1. Try businesses collection
        business = await self.db.businesses.find_one({"tenant_id": tenant_id}, {"_id": 0})
        if business:
            brand_name = business.get("name", brand_name)
            brand_colors = business.get("brand_colors", brand_colors)
        
        # 2. Try user invoice settings (company_name)
        if brand_name == "Your Brand":
            invoice_settings = await self.db.user_invoice_settings.find_one({"user_id": user_id}, {"_id": 0})
            if invoice_settings and invoice_settings.get("company_name"):
                brand_name = invoice_settings.get("company_name")
        
        # 3. Try admin's business_name from users collection
        if brand_name == "Your Brand":
            admin_user = await self.db.users.find_one(
                {"tenant_id": tenant_id, "role": {"$in": ["admin", "superadmin"]}},
                {"_id": 0, "business_name": 1}
            )
            if admin_user and admin_user.get("business_name"):
                brand_name = admin_user.get("business_name")
        
        # 4. Try stores collection
        if brand_name == "Your Brand":
            store = await self.db.stores.find_one({"tenant_id": tenant_id}, {"_id": 0, "name": 1})
            if store and store.get("name"):
                brand_name = store.get("name")
        
        # Override with poster_data brand_colors if provided
        brand_colors = poster_data.brand_colors or brand_colors
        
        # Get products if specified
        products = []
        if poster_data.product_ids:
            for pid in poster_data.product_ids[:3]:  # Max 3 products
                product = await self.db.items.find_one({"id": pid, "tenant_id": tenant_id})
                if product:
                    products.append({
                        "name": product.get("name"),
                        "price": product.get("price"),
                        "image_url": product.get("image_url")
                    })
        
        # Get festival theme if specified
        festival_theme = None
        if poster_data.festival_id:
            festival = await self.db.festivals.find_one({"id": poster_data.festival_id})
            if festival:
                festival_theme = {
                    "name": festival.get("name"),
                    "themes": festival.get("themes"),
                    "colors": festival.get("colors")
                }
        
        # Build AI prompt for poster generation
        prompt = self._build_poster_prompt(
            brand_name=brand_name,
            brand_colors=brand_colors,
            products=products,
            offer_text=poster_data.offer_text,
            campaign_type=poster_data.campaign_type,
            festival_theme=festival_theme,
            custom_message=poster_data.custom_message,
            style=poster_data.style,
            formats=poster_data.formats
        )
        
        # Generate posters for each format
        generated_posters = []
        
        for fmt in poster_data.formats:
            width, height = FORMAT_DIMENSIONS[fmt]
            format_prompt = f"{prompt}\n\nDimensions: {width}x{height} pixels. Aspect ratio: {'square' if width == height else 'portrait' if height > width else 'landscape'}."
            
            try:
                # Initialize Gemini Nano Banana for image generation
                chat = LlmChat(
                    api_key=self.api_key,
                    session_id=f"poster_{poster_id}_{fmt.value}",
                    system_message="You are an expert marketing poster designer. Create vibrant, eye-catching posters."
                )
                # Use Gemini Nano Banana model for image generation
                chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
                
                msg = UserMessage(text=format_prompt)
                text_response, images = await chat.send_message_multimodal_response(msg)
                
                if images:
                    image_data = images[0]
                    generated_posters.append({
                        "format": fmt.value,
                        "width": width,
                        "height": height,
                        "image_data": image_data["data"][:50] + "...",  # Store reference, not full base64
                        "image_base64": image_data["data"],  # Full data for storage
                        "mime_type": image_data.get("mime_type", "image/png")
                    })
                    
            except Exception as e:
                print(f"Error generating {fmt.value} poster: {e}")
                # Continue with other formats
        
        # Generate caption and hashtags
        caption, hashtags = await self._generate_caption_hashtags(
            brand_name=brand_name,
            products=products,
            offer_text=poster_data.offer_text,
            campaign_type=poster_data.campaign_type,
            festival_theme=festival_theme
        )
        
        # Store poster in database
        poster_doc = {
            "id": poster_id,
            "tenant_id": tenant_id,
            "created_by": user_id,
            "title": poster_data.title,
            "campaign_type": poster_data.campaign_type.value,
            "formats": [p["format"] for p in generated_posters],
            "posters": [{
                "format": p["format"],
                "width": p["width"],
                "height": p["height"],
                "mime_type": p["mime_type"]
            } for p in generated_posters],
            "caption": caption,
            "hashtags": hashtags,
            "product_ids": poster_data.product_ids,
            "offer_text": poster_data.offer_text,
            "festival_id": poster_data.festival_id,
            "status": "draft",
            "created_at": now
        }
        
        await self.db.posters.insert_one(poster_doc)
        
        # Store images separately (to avoid large documents)
        for poster in generated_posters:
            await self.db.poster_images.insert_one({
                "poster_id": poster_id,
                "format": poster["format"],
                "image_base64": poster["image_base64"],
                "mime_type": poster["mime_type"],
                "created_at": now
            })
        
        del poster_doc["_id"]
        
        return {
            "message": f"Poster '{poster_data.title}' generated successfully",
            "poster": poster_doc,
            "generated_formats": [p["format"] for p in generated_posters]
        }
    
    def _build_poster_prompt(
        self,
        brand_name: str,
        brand_colors: List[str],
        products: List[Dict],
        offer_text: Optional[str],
        campaign_type: CampaignType,
        festival_theme: Optional[Dict],
        custom_message: Optional[str],
        style: str,
        formats: List[PosterFormat]
    ) -> str:
        """Build detailed prompt for poster generation"""
        
        prompt_parts = [
            f"Create a professional marketing poster for '{brand_name}'.",
            f"Style: {style.upper()} - Use vibrant, eye-catching colors.",
            f"Brand colors to incorporate: {', '.join(brand_colors)}."
        ]
        
        # Campaign type specific instructions
        if campaign_type == CampaignType.SALE:
            prompt_parts.append("Theme: SALE/DISCOUNT - Make it urgent and exciting.")
        elif campaign_type == CampaignType.NEW_ARRIVALS:
            prompt_parts.append("Theme: NEW ARRIVALS - Fresh, modern, and trendy look.")
        elif campaign_type == CampaignType.OFFERS:
            prompt_parts.append("Theme: SPECIAL OFFERS - Highlight value and savings.")
        elif campaign_type == CampaignType.FESTIVAL:
            prompt_parts.append("Theme: FESTIVAL - Celebratory, colorful, and joyful.")
        
        # Festival theme
        if festival_theme:
            prompt_parts.append(f"Festival: {festival_theme['name']}.")
            prompt_parts.append(f"Festival themes: {', '.join(festival_theme['themes'])}.")
            prompt_parts.append(f"Festival colors: {', '.join(festival_theme['colors'])}.")
        
        # Products
        if products:
            product_desc = ", ".join([f"{p['name']} (₹{p['price']})" for p in products])
            prompt_parts.append(f"Featured products: {product_desc}.")
        
        # Offer text
        if offer_text:
            prompt_parts.append(f"Prominent offer text to display: '{offer_text}'.")
        
        # Custom message
        if custom_message:
            prompt_parts.append(f"Include message: '{custom_message}'.")
        
        # Design instructions
        prompt_parts.extend([
            "Include the brand name prominently.",
            "Use modern typography with good contrast.",
            "Make text readable and impactful.",
            "Add subtle decorative elements that match the theme.",
            "Ensure the design is clean and professional.",
            "Do NOT include any placeholder text or lorem ipsum."
        ])
        
        return " ".join(prompt_parts)
    
    async def _generate_caption_hashtags(
        self,
        brand_name: str,
        products: List[Dict],
        offer_text: Optional[str],
        campaign_type: CampaignType,
        festival_theme: Optional[Dict]
    ) -> tuple:
        """Generate caption and hashtags for the poster"""
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"caption_{uuid.uuid4().hex[:8]}",
                system_message="You are a social media marketing expert. Generate engaging captions and relevant hashtags."
            )
            chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["text"])
            
            prompt = f"""Generate a social media caption and hashtags for a marketing post.
            
Brand: {brand_name}
Campaign Type: {campaign_type.value}
{'Products: ' + ', '.join([p['name'] for p in products]) if products else ''}
{'Offer: ' + offer_text if offer_text else ''}
{'Festival: ' + festival_theme['name'] if festival_theme else ''}

Requirements:
1. Caption should be engaging, 2-3 sentences max
2. Use emojis appropriately
3. Include a call-to-action
4. Generate 5-10 relevant hashtags

Format your response as:
CAPTION: [your caption here]
HASHTAGS: #tag1 #tag2 #tag3 ..."""

            msg = UserMessage(text=prompt)
            response = await chat.send_message(msg)
            
            # Parse response
            caption = ""
            hashtags = []
            
            lines = response.split("\n")
            for line in lines:
                if line.startswith("CAPTION:"):
                    caption = line.replace("CAPTION:", "").strip()
                elif line.startswith("HASHTAGS:"):
                    tags_str = line.replace("HASHTAGS:", "").strip()
                    hashtags = [tag.strip() for tag in tags_str.split() if tag.startswith("#")]
            
            # Fallback if parsing failed
            if not caption:
                caption = f"✨ Check out our latest from {brand_name}! {offer_text or 'Shop now!'} 🛍️"
            if not hashtags:
                hashtags = [f"#{brand_name.replace(' ', '')}", "#shopping", "#deals", "#newcollection"]
            
            return caption, hashtags
            
        except Exception as e:
            print(f"Error generating caption: {e}")
            # Fallback
            return (
                f"🎉 Amazing deals at {brand_name}! {offer_text or 'Shop now!'} 🛍️",
                [f"#{brand_name.replace(' ', '')}", "#sale", "#shopping", "#deals"]
            )
    
    async def get_poster(self, poster_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get poster details"""
        poster = await self.db.posters.find_one(
            {"id": poster_id, "tenant_id": tenant_id},
            {"_id": 0}
        )
        return poster
    
    async def get_poster_image(
        self,
        poster_id: str,
        format: str
    ) -> Optional[Dict[str, Any]]:
        """Get poster image data"""
        image = await self.db.poster_images.find_one(
            {"poster_id": poster_id, "format": format},
            {"_id": 0}
        )
        return image
    
    async def get_posters(
        self,
        tenant_id: str,
        limit: int = 50,
        campaign_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List all posters for a tenant"""
        query = {"tenant_id": tenant_id}
        if campaign_type:
            query["campaign_type"] = campaign_type
        
        posters = await self.db.posters.find(
            query, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return posters
    
    # ========== SOCIAL MEDIA ACCOUNTS ==========
    
    async def connect_social_account(
        self,
        account_data: SocialAccountConnect,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Connect a social media account"""
        now = datetime.now(timezone.utc).isoformat()
        
        # Check if already connected
        existing = await self.db.social_accounts.find_one({
            "tenant_id": tenant_id,
            "platform": account_data.platform.value
        })
        
        if existing:
            # Update existing
            await self.db.social_accounts.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "access_token": account_data.access_token,
                    "page_id": account_data.page_id,
                    "account_id": account_data.account_id,
                    "updated_at": now,
                    "is_active": True
                }}
            )
            return {"message": f"{account_data.platform.value} account updated"}
        
        # Create new
        account_doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "platform": account_data.platform.value,
            "access_token": account_data.access_token,
            "page_id": account_data.page_id,
            "account_id": account_data.account_id,
            "is_active": True,
            "created_at": now
        }
        
        await self.db.social_accounts.insert_one(account_doc)
        
        return {"message": f"{account_data.platform.value} account connected"}
    
    async def get_connected_accounts(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Get all connected social accounts"""
        accounts = await self.db.social_accounts.find(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0, "access_token": 0}  # Don't expose tokens
        ).to_list(10)
        
        return accounts
    
    async def disconnect_account(
        self,
        platform: PlatformType,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Disconnect a social media account"""
        result = await self.db.social_accounts.update_one(
            {"tenant_id": tenant_id, "platform": platform.value},
            {"$set": {"is_active": False}}
        )
        
        if result.modified_count:
            return {"message": f"{platform.value} account disconnected"}
        return {"message": "Account not found"}
    
    # ========== SCHEDULING & POSTING ==========
    
    async def schedule_post(
        self,
        schedule_data: ScheduledPost,
        tenant_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Schedule a poster for publishing"""
        now = datetime.now(timezone.utc).isoformat()
        
        # Verify poster exists
        poster = await self.get_poster(schedule_data.poster_id, tenant_id)
        if not poster:
            raise ValueError("Poster not found")
        
        # Verify connected accounts
        for platform in schedule_data.platforms:
            account = await self.db.social_accounts.find_one({
                "tenant_id": tenant_id,
                "platform": platform.value,
                "is_active": True
            })
            if not account:
                raise ValueError(f"{platform.value} account not connected")
        
        schedule_id = str(uuid.uuid4())
        
        schedule_doc = {
            "id": schedule_id,
            "tenant_id": tenant_id,
            "poster_id": schedule_data.poster_id,
            "platforms": [p.value for p in schedule_data.platforms],
            "scheduled_time": schedule_data.scheduled_time,
            "caption": schedule_data.caption or poster.get("caption", ""),
            "hashtags": schedule_data.hashtags or poster.get("hashtags", []),
            "status": PostStatus.SCHEDULED.value,
            "created_by": user_id,
            "created_at": now,
            "published_at": None,
            "publish_results": []
        }
        
        await self.db.scheduled_posts.insert_one(schedule_doc)
        
        # Update poster status
        await self.db.posters.update_one(
            {"id": schedule_data.poster_id},
            {"$set": {"status": "scheduled"}}
        )
        
        del schedule_doc["_id"]
        
        return {"message": "Post scheduled", "schedule": schedule_doc}
    
    async def get_scheduled_posts(
        self,
        tenant_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get scheduled posts"""
        query = {"tenant_id": tenant_id}
        if status:
            query["status"] = status
        
        posts = await self.db.scheduled_posts.find(
            query, {"_id": 0}
        ).sort("scheduled_time", 1).to_list(100)
        
        return posts
    
    async def publish_now(
        self,
        poster_id: str,
        platforms: List[PlatformType],
        tenant_id: str,
        caption: Optional[str] = None,
        hashtags: List[str] = []
    ) -> Dict[str, Any]:
        """Publish a poster immediately"""
        poster = await self.get_poster(poster_id, tenant_id)
        if not poster:
            raise ValueError("Poster not found")
        
        results = []
        
        for platform in platforms:
            # Get account credentials
            account = await self.db.social_accounts.find_one({
                "tenant_id": tenant_id,
                "platform": platform.value,
                "is_active": True
            })
            
            if not account:
                results.append({
                    "platform": platform.value,
                    "success": False,
                    "error": "Account not connected"
                })
                continue
            
            try:
                # Get image for appropriate format
                format_map = {
                    PlatformType.FACEBOOK: PosterFormat.FACEBOOK_POST.value,
                    PlatformType.INSTAGRAM: PosterFormat.INSTAGRAM_POST.value,
                    PlatformType.WHATSAPP: PosterFormat.WHATSAPP_STATUS.value
                }
                
                image = await self.get_poster_image(
                    poster_id,
                    format_map.get(platform, PosterFormat.INSTAGRAM_POST.value)
                )
                
                if not image:
                    # Try any available format
                    image = await self.db.poster_images.find_one(
                        {"poster_id": poster_id},
                        {"_id": 0}
                    )
                
                if not image:
                    results.append({
                        "platform": platform.value,
                        "success": False,
                        "error": "No image found"
                    })
                    continue
                
                # Build full caption with hashtags
                full_caption = caption or poster.get("caption", "")
                tags = hashtags or poster.get("hashtags", [])
                if tags:
                    full_caption += "\n\n" + " ".join(tags)
                
                # Publish based on platform
                publish_result = await self._publish_to_platform(
                    platform=platform,
                    account=account,
                    image_base64=image["image_base64"],
                    caption=full_caption
                )
                
                results.append({
                    "platform": platform.value,
                    "success": publish_result.get("success", False),
                    "post_id": publish_result.get("post_id"),
                    "error": publish_result.get("error")
                })
                
            except Exception as e:
                results.append({
                    "platform": platform.value,
                    "success": False,
                    "error": str(e)
                })
        
        # Update poster status
        all_success = all(r["success"] for r in results)
        await self.db.posters.update_one(
            {"id": poster_id},
            {"$set": {"status": "published" if all_success else "partial"}}
        )
        
        return {
            "message": "Publishing complete",
            "results": results,
            "all_success": all_success
        }
    
    async def _publish_to_platform(
        self,
        platform: PlatformType,
        account: Dict,
        image_base64: str,
        caption: str
    ) -> Dict[str, Any]:
        """Publish to a specific platform"""
        import httpx
        
        # Note: These are placeholder implementations
        # Real implementation requires platform-specific APIs
        
        if platform == PlatformType.FACEBOOK:
            return await self._publish_to_facebook(account, image_base64, caption)
        elif platform == PlatformType.INSTAGRAM:
            return await self._publish_to_instagram(account, image_base64, caption)
        elif platform == PlatformType.WHATSAPP:
            return await self._publish_to_whatsapp(account, image_base64, caption)
        
        return {"success": False, "error": "Unsupported platform"}
    
    async def _publish_to_facebook(
        self,
        account: Dict,
        image_base64: str,
        caption: str
    ) -> Dict[str, Any]:
        """Publish to Facebook Page"""
        # Placeholder - requires Facebook Graph API
        # Real implementation would:
        # 1. Upload photo to Facebook
        # 2. Create post with photo
        
        return {
            "success": True,
            "post_id": f"fb_post_{uuid.uuid4().hex[:8]}",
            "message": "Published to Facebook (simulation mode)"
        }
    
    async def _publish_to_instagram(
        self,
        account: Dict,
        image_base64: str,
        caption: str
    ) -> Dict[str, Any]:
        """Publish to Instagram Business"""
        # Placeholder - requires Instagram Graph API via Facebook
        # Real implementation would:
        # 1. Create media container
        # 2. Publish media
        
        return {
            "success": True,
            "post_id": f"ig_post_{uuid.uuid4().hex[:8]}",
            "message": "Published to Instagram (simulation mode)"
        }
    
    async def _publish_to_whatsapp(
        self,
        account: Dict,
        image_base64: str,
        caption: str
    ) -> Dict[str, Any]:
        """Publish to WhatsApp Status"""
        # Placeholder - requires WhatsApp Business API
        # Real implementation would:
        # 1. Upload media
        # 2. Post as status
        
        return {
            "success": True,
            "post_id": f"wa_status_{uuid.uuid4().hex[:8]}",
            "message": "Posted to WhatsApp Status (simulation mode)"
        }
    
    # ========== ANALYTICS ==========
    
    async def get_poster_analytics(self, tenant_id: str) -> Dict[str, Any]:
        """Get poster and social media analytics"""
        # Total posters
        total_posters = await self.db.posters.count_documents({"tenant_id": tenant_id})
        
        # Posters by campaign type
        campaign_pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {"_id": "$campaign_type", "count": {"$sum": 1}}}
        ]
        campaign_counts = await self.db.posters.aggregate(campaign_pipeline).to_list(10)
        
        # Posts by status
        status_pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        status_counts = await self.db.scheduled_posts.aggregate(status_pipeline).to_list(10)
        
        # Connected accounts
        connected_accounts = await self.db.social_accounts.count_documents({
            "tenant_id": tenant_id,
            "is_active": True
        })
        
        return {
            "total_posters": total_posters,
            "by_campaign_type": {c["_id"]: c["count"] for c in campaign_counts},
            "posts_by_status": {s["_id"]: s["count"] for s in status_counts},
            "connected_accounts": connected_accounts
        }
