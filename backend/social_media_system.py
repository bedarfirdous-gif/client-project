"""
Social Media Integration System for Auto Poster
================================================
Facebook Graph API and Instagram Graph API integration for auto-posting.

Features:
- Facebook Page OAuth connection
- Instagram Business Account connection (via Facebook)
- Post images with captions to Facebook Pages
- Post images to Instagram Business accounts
- WhatsApp Business API integration (placeholder)
"""

import os
import httpx
import uuid
import base64
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from enum import Enum
import logging

logger = logging.getLogger(__name__)

# ============== MODELS ==============

class SocialPlatform(str, Enum):
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    WHATSAPP = "whatsapp"

class OAuthConfig(BaseModel):
    app_id: str
    app_secret: str
    redirect_uri: str

class FacebookOAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None

# ============== SOCIAL MEDIA SYSTEM ==============

class SocialMediaSystem:
    """
    Handles Facebook and Instagram API integrations for the Auto Poster Studio.
    
    Facebook Graph API Documentation: https://developers.facebook.com/docs/graph-api
    Instagram Graph API Documentation: https://developers.facebook.com/docs/instagram-api
    """
    
    FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v19.0"
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.accounts_collection = db.social_accounts
        self.posts_collection = db.social_posts
        self.oauth_collection = db.social_oauth_config
    
    # ============== OAUTH CONFIGURATION ==============
    
    async def save_oauth_config(
        self,
        tenant_id: str,
        platform: SocialPlatform,
        app_id: str,
        app_secret: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """Save OAuth configuration for a platform"""
        await self.oauth_collection.update_one(
            {"tenant_id": tenant_id, "platform": platform.value},
            {"$set": {
                "tenant_id": tenant_id,
                "platform": platform.value,
                "app_id": app_id,
                "app_secret": app_secret,
                "redirect_uri": redirect_uri,
                "updated_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
        return {"success": True, "message": f"{platform.value} OAuth config saved"}
    
    async def get_oauth_config(self, tenant_id: str, platform: SocialPlatform) -> Optional[Dict[str, Any]]:
        """Get OAuth configuration for a platform"""
        config = await self.oauth_collection.find_one(
            {"tenant_id": tenant_id, "platform": platform.value},
            {"_id": 0}
        )
        return config
    
    # ============== FACEBOOK OAUTH ==============
    
    def get_facebook_login_url(self, app_id: str, redirect_uri: str, state: str) -> str:
        """Generate Facebook OAuth login URL"""
        permissions = [
            "pages_show_list",
            "pages_read_engagement",
            "pages_manage_posts",
            "pages_manage_metadata",
            "instagram_basic",
            "instagram_content_publish",
            "instagram_manage_comments",
            "business_management"
        ]
        
        scope = ",".join(permissions)
        
        return (
            f"https://www.facebook.com/v19.0/dialog/oauth?"
            f"client_id={app_id}&"
            f"redirect_uri={redirect_uri}&"
            f"scope={scope}&"
            f"state={state}&"
            f"response_type=code"
        )
    
    async def exchange_facebook_code(
        self,
        code: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        config = await self.get_oauth_config(tenant_id, SocialPlatform.FACEBOOK)
        if not config:
            return {"success": False, "error": "Facebook OAuth not configured"}
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Exchange code for short-lived token
                response = await client.get(
                    f"{self.FACEBOOK_GRAPH_URL}/oauth/access_token",
                    params={
                        "client_id": config["app_id"],
                        "client_secret": config["app_secret"],
                        "redirect_uri": config["redirect_uri"],
                        "code": code
                    }
                )
                
                if response.status_code != 200:
                    return {"success": False, "error": response.text}
                
                data = response.json()
                short_token = data.get("access_token")
                
                # Exchange for long-lived token
                long_token_response = await client.get(
                    f"{self.FACEBOOK_GRAPH_URL}/oauth/access_token",
                    params={
                        "grant_type": "fb_exchange_token",
                        "client_id": config["app_id"],
                        "client_secret": config["app_secret"],
                        "fb_exchange_token": short_token
                    }
                )
                
                if long_token_response.status_code == 200:
                    long_data = long_token_response.json()
                    access_token = long_data.get("access_token", short_token)
                else:
                    access_token = short_token
                
                # Get user info
                me_response = await client.get(
                    f"{self.FACEBOOK_GRAPH_URL}/me",
                    params={"access_token": access_token, "fields": "id,name"}
                )
                user_data = me_response.json() if me_response.status_code == 200 else {}
                
                return {
                    "success": True,
                    "access_token": access_token,
                    "user_id": user_data.get("id"),
                    "user_name": user_data.get("name")
                }
                
        except Exception as e:
            logger.error(f"Facebook OAuth error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_facebook_pages(
        self,
        user_access_token: str
    ) -> Dict[str, Any]:
        """Get list of Facebook Pages the user manages"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.FACEBOOK_GRAPH_URL}/me/accounts",
                    params={
                        "access_token": user_access_token,
                        "fields": "id,name,access_token,instagram_business_account"
                    }
                )
                
                if response.status_code != 200:
                    return {"success": False, "error": response.text}
                
                data = response.json()
                pages = []
                
                for page in data.get("data", []):
                    page_info = {
                        "id": page["id"],
                        "name": page["name"],
                        "access_token": page["access_token"],
                        "has_instagram": False,
                        "instagram_account_id": None
                    }
                    
                    # Check for linked Instagram account
                    if "instagram_business_account" in page:
                        page_info["has_instagram"] = True
                        page_info["instagram_account_id"] = page["instagram_business_account"]["id"]
                    
                    pages.append(page_info)
                
                return {"success": True, "pages": pages}
                
        except Exception as e:
            logger.error(f"Error fetching Facebook pages: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def connect_facebook_page(
        self,
        tenant_id: str,
        page_id: str,
        page_name: str,
        page_access_token: str,
        instagram_account_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Connect a Facebook Page for posting"""
        now = datetime.now(timezone.utc)
        
        # Save Facebook account
        await self.accounts_collection.update_one(
            {"tenant_id": tenant_id, "platform": SocialPlatform.FACEBOOK.value},
            {"$set": {
                "tenant_id": tenant_id,
                "platform": SocialPlatform.FACEBOOK.value,
                "page_id": page_id,
                "page_name": page_name,
                "access_token": page_access_token,
                "is_active": True,
                "connected_at": now,
                "updated_at": now
            }},
            upsert=True
        )
        
        # If Instagram is linked, save it too
        if instagram_account_id:
            await self.accounts_collection.update_one(
                {"tenant_id": tenant_id, "platform": SocialPlatform.INSTAGRAM.value},
                {"$set": {
                    "tenant_id": tenant_id,
                    "platform": SocialPlatform.INSTAGRAM.value,
                    "account_id": instagram_account_id,
                    "page_access_token": page_access_token,  # Instagram uses page token
                    "linked_facebook_page": page_id,
                    "is_active": True,
                    "connected_at": now,
                    "updated_at": now
                }},
                upsert=True
            )
        
        return {
            "success": True,
            "message": "Facebook Page connected",
            "instagram_connected": instagram_account_id is not None
        }
    
    # ============== FACEBOOK POSTING ==============
    
    async def post_to_facebook(
        self,
        tenant_id: str,
        image_url: str,
        caption: str
    ) -> Dict[str, Any]:
        """Post an image to Facebook Page"""
        account = await self.accounts_collection.find_one({
            "tenant_id": tenant_id,
            "platform": SocialPlatform.FACEBOOK.value,
            "is_active": True
        })
        
        if not account:
            return {"success": False, "error": "Facebook account not connected"}
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Post photo to Facebook Page
                response = await client.post(
                    f"{self.FACEBOOK_GRAPH_URL}/{account['page_id']}/photos",
                    data={
                        "url": image_url,
                        "caption": caption,
                        "access_token": account["access_token"]
                    }
                )
                
                if response.status_code != 200:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", response.text)
                    }
                
                data = response.json()
                post_id = data.get("id") or data.get("post_id")
                
                # Log the post
                await self._log_post(
                    tenant_id=tenant_id,
                    platform=SocialPlatform.FACEBOOK,
                    post_id=post_id,
                    caption=caption,
                    success=True
                )
                
                return {
                    "success": True,
                    "post_id": post_id,
                    "platform": "facebook"
                }
                
        except Exception as e:
            logger.error(f"Facebook posting error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def post_to_facebook_base64(
        self,
        tenant_id: str,
        image_base64: str,
        caption: str
    ) -> Dict[str, Any]:
        """Post a base64 image to Facebook Page"""
        account = await self.accounts_collection.find_one({
            "tenant_id": tenant_id,
            "platform": SocialPlatform.FACEBOOK.value,
            "is_active": True
        })
        
        if not account:
            return {"success": False, "error": "Facebook account not connected"}
        
        try:
            # Decode base64 image
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            image_data = base64.b64decode(image_base64)
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Upload photo to Facebook Page
                files = {"source": ("poster.png", image_data, "image/png")}
                
                response = await client.post(
                    f"{self.FACEBOOK_GRAPH_URL}/{account['page_id']}/photos",
                    data={
                        "caption": caption,
                        "access_token": account["access_token"]
                    },
                    files=files
                )
                
                if response.status_code != 200:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", response.text)
                    }
                
                data = response.json()
                post_id = data.get("id") or data.get("post_id")
                
                await self._log_post(
                    tenant_id=tenant_id,
                    platform=SocialPlatform.FACEBOOK,
                    post_id=post_id,
                    caption=caption,
                    success=True
                )
                
                return {
                    "success": True,
                    "post_id": post_id,
                    "platform": "facebook"
                }
                
        except Exception as e:
            logger.error(f"Facebook posting error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    # ============== INSTAGRAM POSTING ==============
    
    async def post_to_instagram(
        self,
        tenant_id: str,
        image_url: str,
        caption: str
    ) -> Dict[str, Any]:
        """
        Post an image to Instagram Business Account.
        
        Instagram Graph API requires:
        1. Create a media container
        2. Publish the container
        
        Note: Image must be hosted on a public URL
        """
        account = await self.accounts_collection.find_one({
            "tenant_id": tenant_id,
            "platform": SocialPlatform.INSTAGRAM.value,
            "is_active": True
        })
        
        if not account:
            return {"success": False, "error": "Instagram account not connected"}
        
        ig_account_id = account.get("account_id")
        access_token = account.get("page_access_token")
        
        if not ig_account_id or not access_token:
            return {"success": False, "error": "Instagram account not properly configured"}
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Step 1: Create media container
                container_response = await client.post(
                    f"{self.FACEBOOK_GRAPH_URL}/{ig_account_id}/media",
                    data={
                        "image_url": image_url,
                        "caption": caption,
                        "access_token": access_token
                    }
                )
                
                if container_response.status_code != 200:
                    error_data = container_response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", container_response.text)
                    }
                
                container_data = container_response.json()
                container_id = container_data.get("id")
                
                if not container_id:
                    return {"success": False, "error": "Failed to create media container"}
                
                # Step 2: Publish the container
                publish_response = await client.post(
                    f"{self.FACEBOOK_GRAPH_URL}/{ig_account_id}/media_publish",
                    data={
                        "creation_id": container_id,
                        "access_token": access_token
                    }
                )
                
                if publish_response.status_code != 200:
                    error_data = publish_response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", publish_response.text)
                    }
                
                publish_data = publish_response.json()
                post_id = publish_data.get("id")
                
                await self._log_post(
                    tenant_id=tenant_id,
                    platform=SocialPlatform.INSTAGRAM,
                    post_id=post_id,
                    caption=caption,
                    success=True
                )
                
                return {
                    "success": True,
                    "post_id": post_id,
                    "platform": "instagram"
                }
                
        except Exception as e:
            logger.error(f"Instagram posting error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    # ============== WHATSAPP (PLACEHOLDER) ==============
    
    async def post_to_whatsapp(
        self,
        tenant_id: str,
        image_base64: str,
        caption: str
    ) -> Dict[str, Any]:
        """
        Post to WhatsApp Business API (placeholder).
        
        WhatsApp Business API requires:
        1. WhatsApp Business account
        2. Approved message templates for marketing
        3. Phone number verification
        """
        # Placeholder - WhatsApp Business API integration would go here
        return {
            "success": False,
            "error": "WhatsApp Business API integration pending. Please use WhatsApp Web share option."
        }
    
    # ============== HELPERS ==============
    
    async def _log_post(
        self,
        tenant_id: str,
        platform: SocialPlatform,
        post_id: str,
        caption: str,
        success: bool,
        error: Optional[str] = None
    ):
        """Log a social media post"""
        await self.posts_collection.insert_one({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "platform": platform.value,
            "post_id": post_id,
            "caption": caption[:500] if caption else "",
            "success": success,
            "error": error,
            "posted_at": datetime.now(timezone.utc)
        })
    
    async def get_post_history(
        self,
        tenant_id: str,
        platform: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get posting history"""
        query = {"tenant_id": tenant_id}
        if platform:
            query["platform"] = platform
        
        posts = await self.posts_collection.find(
            query, {"_id": 0}
        ).sort("posted_at", -1).limit(limit).to_list(limit)
        
        return posts
    
    async def get_connected_accounts(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Get all connected social accounts"""
        accounts = await self.accounts_collection.find(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0, "access_token": 0, "page_access_token": 0}  # Don't expose tokens
        ).to_list(10)
        
        return accounts
    
    async def disconnect_account(
        self,
        tenant_id: str,
        platform: SocialPlatform
    ) -> Dict[str, Any]:
        """Disconnect a social media account"""
        result = await self.accounts_collection.update_one(
            {"tenant_id": tenant_id, "platform": platform.value},
            {"$set": {"is_active": False, "disconnected_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count:
            return {"success": True, "message": f"{platform.value} disconnected"}
        return {"success": False, "error": "Account not found"}
