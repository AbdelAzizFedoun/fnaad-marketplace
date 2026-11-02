import mimetypes
import base64
import tempfile
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from PIL import Image

from accounts.models import ArtistProfile, ArtistStudioPhoto, Notification, User
from accounts.models import (
    ArtistStudioStoryComment,
    ArtistStudioStoryLike,
    ArtistStudioStoryView,
)
from .models import Conversation, Message, Product


class CatalogPermissionTests(APITestCase):
    def setUp(self):
        self.client = APIClient()

        self.customer = User.objects.create_user(
            email="customer1@example.com",
            username="customer1",
            phone_number="+221000000001",
            password="pass12345",
            role=User.ROLE_CUSTOMER,
        )
        self.other_customer = User.objects.create_user(
            email="customer2@example.com",
            username="customer2",
            phone_number="+221000000002",
            password="pass12345",
            role=User.ROLE_CUSTOMER,
        )
        self.artist = User.objects.create_user(
            email="artist1@example.com",
            username="artist1",
            phone_number="+221000000003",
            password="pass12345",
            role=User.ROLE_ARTIST,
        )
        self.artist_profile = ArtistProfile.objects.create(
            user=self.artist,
            brand_name="Artist One",
            mobile_money_number="+221000000003",
            mobile_money_provider="orange",
            region=ArtistProfile.REGION_CENTRE,
        )
        self.buyer_artist = User.objects.create_user(
            email="artist2@example.com",
            username="artist2",
            phone_number="+221000000004",
            password="pass12345",
            role=User.ROLE_ARTIST,
        )
        self.buyer_artist_profile = ArtistProfile.objects.create(
            user=self.buyer_artist,
            brand_name="Artist Two",
            mobile_money_number="+221000000004",
            mobile_money_provider="mtn",
            region=ArtistProfile.REGION_LITTORAL,
        )
        self.staff = User.objects.create_user(
            email="staff1@example.com",
            username="staff1",
            phone_number="+221000000005",
            password="pass12345",
            role=User.ROLE_SUPERADMIN,
            is_staff=True,
        )

        self.product = Product.objects.create(
            artist=self.artist_profile,
            title="Approved artwork",
            description="Ready for buyers",
            price_xaf=5000,
            category=Product.CATEGORY_OTHER,
            status=Product.STATUS_APPROVED,
        )
        self.pending_product = Product.objects.create(
            artist=self.artist_profile,
            title="Pending artwork",
            price_xaf=6000,
            category=Product.CATEGORY_OTHER,
            status=Product.STATUS_PENDING,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def test_customer_like_notifies_artist_once_and_unlike_does_not_notify(self):
        self.authenticate(self.customer)

        response = self.client.post(
            reverse("favorite-toggle"),
            {"product": self.product.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["favorited"])
        notification = Notification.objects.get(user=self.artist)
        self.assertEqual(notification.notification_type, "favorite")
        self.assertEqual(notification.title, "New Like")
        self.assertEqual(notification.data["product_id"], self.product.id)
        self.assertIn(self.customer.username, notification.body)

        unlike_response = self.client.post(
            reverse("favorite-toggle"),
            {"product": self.product.id},
            format="json",
        )

        self.assertEqual(unlike_response.status_code, status.HTTP_200_OK)
        self.assertFalse(unlike_response.data["favorited"])
        self.assertEqual(Notification.objects.filter(user=self.artist).count(), 1)

    def test_artist_liking_own_product_does_not_notify_themself(self):
        self.authenticate(self.artist)

        response = self.client.post(
            reverse("favorite-toggle"),
            {"product": self.product.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Notification.objects.filter(user=self.artist).exists())

    def test_product_comment_notifies_artist(self):
        self.authenticate(self.customer)

        response = self.client.post(
            reverse("product-comments", args=[self.product.id]),
            {"text": "Beautiful artwork"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        notification = Notification.objects.get(user=self.artist, notification_type="comment")
        self.assertEqual(notification.data["product_id"], self.product.id)
        self.assertIn(self.customer.username, notification.body)
        self.assertIn(self.product.title, notification.body)

    def test_follow_notification_includes_follower_and_opens_limited_profile(self):
        self.authenticate(self.customer)

        follow_response = self.client.post(
            reverse("artist-follow", args=[self.artist_profile.id]),
            format="json",
        )

        self.assertEqual(follow_response.status_code, status.HTTP_200_OK)
        notification = Notification.objects.get(
            user=self.artist,
            notification_type="artist_follow",
        )
        self.assertEqual(notification.data["follower_id"], self.customer.id)
        self.assertEqual(notification.data["artist_id"], self.artist_profile.id)

        self.authenticate(self.artist)
        profile_response = self.client.get(
            reverse("follower-profile", args=[self.customer.id])
        )

        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data["username"], self.customer.username)
        self.assertEqual(profile_response.data["role"], User.ROLE_CUSTOMER)
        self.assertEqual(
            set(profile_response.data),
            {"id", "username", "profile_photo", "role", "artist_name"},
        )
        self.assertNotIn("email", profile_response.data)
        self.assertNotIn("phone_number", profile_response.data)

    def test_follower_profile_is_limited_to_followers_in_my_notifications(self):
        self.authenticate(self.artist)

        response = self.client.get(
            reverse("follower-profile", args=[self.customer.id])
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_artist_follower_profile_includes_artist_name_and_role(self):
        self.authenticate(self.buyer_artist)
        follow_response = self.client.post(
            reverse("artist-follow", args=[self.artist_profile.id]),
            format="json",
        )
        self.assertEqual(follow_response.status_code, status.HTTP_200_OK)

        self.authenticate(self.artist)
        profile_response = self.client.get(
            reverse("follower-profile", args=[self.buyer_artist.id])
        )

        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data["role"], User.ROLE_ARTIST)
        self.assertEqual(profile_response.data["artist_name"], "Artist Two")

    def test_customer_cannot_create_product_or_gain_artist_profile(self):
        self.authenticate(self.customer)

        response = self.client.post(
            reverse("product-create"),
            {"title": "Customer product", "description": "Nope", "price_xaf": 5000},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(ArtistProfile.objects.filter(user=self.customer).exists())
        self.assertFalse(Product.objects.filter(title="Customer product").exists())

    def test_artist_can_create_product_and_it_starts_pending(self):
        artist_without_profile = User.objects.create_user(
            email="artist3@example.com",
            username="artist3",
            phone_number="+221000000006",
            password="pass12345",
            role=User.ROLE_ARTIST,
        )
        self.authenticate(artist_without_profile)

        response = self.client.post(
            reverse("product-create"),
            {
                "title": "New artwork",
                "description": "Fresh submission",
                "price_xaf": 5000,
                "status": Product.STATUS_APPROVED,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        product = Product.objects.get(title="New artwork")
        self.assertEqual(product.artist.user, artist_without_profile)
        self.assertEqual(product.status, Product.STATUS_PENDING)

    def test_artist_can_upload_a_product_image(self):
        """The image upload endpoint must persist the multipart file, not only its row."""
        self.authenticate(self.artist)
        image = SimpleUploadedFile(
            "artwork.gif",
            base64.b64decode("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
            content_type="image/gif",
        )

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                response = self.client.post(
                    reverse("product-image-upload", args=[self.pending_product.id]),
                    {"image": image, "is_primary": "true", "order": "0"},
                    format="multipart",
                )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.pending_product.refresh_from_db()
                saved_image = self.pending_product.images.get()
                self.assertTrue(saved_image.image.name)
                self.assertTrue(saved_image.thumbnail.name)
                self.assertEqual(mimetypes.guess_type(saved_image.thumbnail.name)[0], "image/webp")
                self.assertTrue(response.data["image"].endswith(saved_image.image.url))
                self.assertTrue(response.data["thumbnail"].endswith(saved_image.thumbnail.url))

    def test_public_gallery_and_detail_only_expose_approved_products(self):
        response = self.client.get(reverse("product-list"))
        product_ids = {item["id"] for item in response.data}

        self.assertIn(self.product.id, product_ids)
        self.assertNotIn(self.pending_product.id, product_ids)

        response = self.client.get(reverse("product-detail", args=[self.pending_product.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.authenticate(self.artist)
        response = self.client.get(reverse("product-detail", args=[self.pending_product.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_legacy_customer_with_artist_profile_still_cannot_act_as_artist(self):
        legacy_profile = ArtistProfile.objects.create(
            user=self.customer,
            brand_name="Legacy Customer Profile",
            mobile_money_number="+221000000001",
            mobile_money_provider="orange",
        )
        legacy_product = Product.objects.create(
            artist=legacy_profile,
            title="Legacy pending",
            price_xaf=5000,
            status=Product.STATUS_PENDING,
        )
        self.authenticate(self.customer)

        mine_response = self.client.get(reverse("product-mine"))
        detail_response = self.client.get(reverse("product-detail", args=[legacy_product.id]))
        profile_response = self.client.get(reverse("artist-profile-me"))

        self.assertEqual(mine_response.status_code, status.HTTP_200_OK)
        self.assertEqual(mine_response.data, [])
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(profile_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_customer_can_use_own_conversation_but_cannot_deliver_or_see_others(self):
        self.authenticate(self.customer)

        start_response = self.client.post(
            reverse("conversation-start"),
            {"product": self.product.id},
            format="json",
        )
        self.assertEqual(start_response.status_code, status.HTTP_201_CREATED)
        conversation_id = start_response.data["id"]

        message_response = self.client.post(
            reverse("message-send"),
            {"conversation": conversation_id, "text": "Hello"},
            format="json",
        )
        self.assertEqual(message_response.status_code, status.HTTP_201_CREATED)

        deliver_response = self.client.patch(
            reverse("conversation-status", args=[conversation_id]),
            {"status": Conversation.STATUS_DELIVERED},
            format="json",
        )
        self.assertEqual(deliver_response.status_code, status.HTTP_403_FORBIDDEN)

        confirm_response = self.client.patch(
            reverse("conversation-status", args=[conversation_id]),
            {"status": Conversation.STATUS_CONFIRMED},
            format="json",
        )
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)

        report_response = self.client.patch(
            reverse("conversation-report", args=[conversation_id]),
            {"reason": "Problem with this order"},
            format="json",
        )
        self.assertEqual(report_response.status_code, status.HTTP_200_OK)

        self.authenticate(self.other_customer)
        list_response = self.client.get(reverse("conversation-list"))
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data, [])

    def test_artist_seller_can_reply_and_deliver_but_not_confirm(self):
        conversation = Conversation.objects.create(
            product=self.product,
            customer=self.customer,
            status=Conversation.STATUS_CONFIRMED,
        )
        self.authenticate(self.artist)

        list_response = self.client.get(reverse("conversation-list"))
        self.assertEqual([item["id"] for item in list_response.data], [conversation.id])

        message_response = self.client.post(
            reverse("message-send"),
            {"conversation": conversation.id, "text": "On my way"},
            format="json",
        )
        self.assertEqual(message_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.get(conversation=conversation).sender, self.artist)

        confirm_response = self.client.patch(
            reverse("conversation-status", args=[conversation.id]),
            {"status": Conversation.STATUS_CONFIRMED},
            format="json",
        )
        self.assertEqual(confirm_response.status_code, status.HTTP_403_FORBIDDEN)

        deliver_response = self.client.patch(
            reverse("conversation-status", args=[conversation.id]),
            {"status": Conversation.STATUS_DELIVERED},
            format="json",
        )
        self.assertEqual(deliver_response.status_code, status.HTTP_200_OK)
        conversation.refresh_from_db()
        self.assertEqual(conversation.status, Conversation.STATUS_DELIVERED)

    def test_messages_can_reply_and_toggle_reactions_only_within_the_same_conversation(self):
        conversation = Conversation.objects.create(product=self.product, customer=self.customer)
        source_message = Message.objects.create(
            conversation=conversation,
            sender=self.customer,
            text="Can this be delivered this week?",
        )
        other_conversation = Conversation.objects.create(
            product=self.pending_product,
            customer=self.other_customer,
        )
        foreign_message = Message.objects.create(
            conversation=other_conversation,
            sender=self.other_customer,
            text="A message in another conversation",
        )

        self.authenticate(self.artist)
        reply_response = self.client.post(
            reverse("message-send"),
            {
                "conversation": conversation.id,
                "text": "Yes, I can.",
                "reply_to_id": source_message.id,
            },
            format="json",
        )
        self.assertEqual(reply_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reply_response.data["reply_to"]["id"], source_message.id)

        reaction_response = self.client.post(
            reverse("message-reaction", args=[source_message.id]),
            {"emoji": "❤️"},
            format="json",
        )
        self.assertEqual(reaction_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reaction_response.data["reactions"], [
            {"emoji": "❤️", "count": 1, "reacted_by_me": True}
        ])

        remove_reaction_response = self.client.post(
            reverse("message-reaction", args=[source_message.id]),
            {"emoji": "❤️"},
            format="json",
        )
        self.assertEqual(remove_reaction_response.status_code, status.HTTP_200_OK)
        self.assertEqual(remove_reaction_response.data["reactions"], [])

        invalid_reply_response = self.client.post(
            reverse("message-send"),
            {
                "conversation": conversation.id,
                "text": "This should not be allowed.",
                "reply_to_id": foreign_message.id,
            },
            format="json",
        )
        self.assertEqual(invalid_reply_response.status_code, status.HTTP_400_BAD_REQUEST)

        self.authenticate(self.other_customer)
        forbidden_reaction_response = self.client.post(
            reverse("message-reaction", args=[source_message.id]),
            {"emoji": "👍"},
            format="json",
        )
        self.assertEqual(forbidden_reaction_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_artist_can_act_as_customer_for_another_artists_product(self):
        self.authenticate(self.buyer_artist)

        start_response = self.client.post(
            reverse("conversation-start"),
            {"product": self.product.id},
            format="json",
        )
        self.assertEqual(start_response.status_code, status.HTTP_201_CREATED)
        conversation_id = start_response.data["id"]

        list_response = self.client.get(reverse("conversation-list"))
        self.assertEqual([item["id"] for item in list_response.data], [conversation_id])

        message_response = self.client.post(
            reverse("message-send"),
            {"conversation": conversation_id, "text": "I want to buy this"},
            format="json",
        )
        self.assertEqual(message_response.status_code, status.HTTP_201_CREATED)

        deliver_response = self.client.patch(
            reverse("conversation-status", args=[conversation_id]),
            {"status": Conversation.STATUS_DELIVERED},
            format="json",
        )
        self.assertEqual(deliver_response.status_code, status.HTTP_403_FORBIDDEN)

        confirm_response = self.client.patch(
            reverse("conversation-status", args=[conversation_id]),
            {"status": Conversation.STATUS_CONFIRMED},
            format="json",
        )
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)

    def test_artist_cannot_start_conversation_with_self(self):
        self.authenticate(self.artist)

        response = self.client.post(
            reverse("conversation-start"),
            {"product": self.product.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_artist_profile_restricted_fields_are_read_only(self):
        self.authenticate(self.artist)

        response = self.client.patch(
            reverse("artist-profile-me"),
            {
                "brand_name": "Updated Artist",
                "region": ArtistProfile.REGION_EST,
                "gender": ArtistProfile.GENDER_FEMALE,
                "is_verified": True,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.artist_profile.refresh_from_db()
        self.assertEqual(self.artist_profile.brand_name, "Updated Artist")
        self.assertEqual(self.artist_profile.region, ArtistProfile.REGION_CENTRE)
        self.assertEqual(self.artist_profile.gender, ArtistProfile.GENDER_UNSPECIFIED)
        self.assertFalse(self.artist_profile.is_verified)

    def test_staff_endpoints_are_admin_only(self):
        self.authenticate(self.customer)
        customer_response = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(customer_response.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.staff)
        staff_response = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(staff_response.status_code, status.HTTP_200_OK)

    def test_conversation_status_cannot_be_changed_by_generic_put(self):
        conversation = Conversation.objects.create(product=self.product, customer=self.customer)
        self.authenticate(self.customer)

        response = self.client.put(
            reverse("conversation-status", args=[conversation.id]),
            {"status": Conversation.STATUS_DELIVERED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        conversation.refresh_from_db()
        self.assertEqual(conversation.status, Conversation.STATUS_NEGOTIATING)


class ArtistStudioPhotoApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.artist_user = User.objects.create_user(
            email="studio-artist@example.com",
            username="studio-artist",
            phone_number="+221000000101",
            password="test-password",
            role=User.ROLE_ARTIST,
        )
        self.artist = ArtistProfile.objects.create(
            user=self.artist_user,
            brand_name="Studio Artist",
            mobile_money_number="+221000000101",
            mobile_money_provider="orange",
        )
        self.other_artist_user = User.objects.create_user(
            email="other-studio-artist@example.com",
            username="other-studio-artist",
            phone_number="+221000000102",
            password="test-password",
            role=User.ROLE_ARTIST,
        )
        self.other_artist = ArtistProfile.objects.create(
            user=self.other_artist_user,
            brand_name="Another Artist",
            mobile_money_number="+221000000102",
            mobile_money_provider="mtn",
        )
        self.customer = User.objects.create_user(
            email="studio-customer@example.com",
            username="studio-customer",
            phone_number="+221000000103",
            password="test-password",
            role=User.ROLE_CUSTOMER,
        )
        self.media_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        self.media_settings = override_settings(MEDIA_ROOT=self.media_directory.name)
        self.media_settings.enable()
        self.addCleanup(self.media_settings.disable)

    def make_photo_upload(self, name="studio.png"):
        image_buffer = BytesIO()
        Image.new("RGB", (2, 2), color="orange").save(image_buffer, format="PNG")
        return SimpleUploadedFile(name, image_buffer.getvalue(), content_type="image/png")

    def make_video_upload(self, name="studio.mp4"):
        return SimpleUploadedFile(name, b"studio video fixture", content_type="video/mp4")

    def test_artist_can_add_view_publicly_and_delete_studio_photo(self):
        self.client.force_authenticate(self.artist_user)
        response = self.client.post(
            reverse("artist-studio-photos"),
            {"image": self.make_photo_upload(), "caption": "Painting in my studio"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        photo_id = response.data["id"]
        photo = self.artist.studio_photos.get(pk=photo_id)
        stored_image_name = photo.image.name
        self.assertEqual(photo.caption, "Painting in my studio")
        self.assertTrue(photo.image.storage.exists(stored_image_name))

        list_response = self.client.get(reverse("artist-studio-photos"))
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data[0]["id"], photo_id)

        public_response = self.client.get(reverse("artist-profile", args=[self.artist.pk]))
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.data["studio_photos"][0]["caption"], "Painting in my studio")

        delete_response = self.client.delete(reverse("artist-studio-photo-delete", args=[photo_id]))
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(photo.image.storage.exists(stored_image_name))
        self.assertFalse(self.artist.studio_photos.filter(pk=photo_id).exists())

    def test_public_stories_feed_includes_artist_and_media_details(self):
        photo = self.artist.studio_photos.create(
            image=self.make_photo_upload(),
            caption="At work in my studio",
        )
        self.other_artist.is_suspended = True
        self.other_artist.save(update_fields=["is_suspended"])
        self.other_artist.studio_photos.create(
            image=self.make_photo_upload("suspended-studio.png"),
            caption="Suspended artist studio",
        )

        response = self.client.get(reverse("artist-stories"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        story = response.data["results"][0]
        self.assertEqual(story["id"], photo.id)
        self.assertEqual(story["artist_id"], self.artist.id)
        self.assertEqual(story["artist_name"], self.artist.brand_name)
        self.assertEqual(story["caption"], "At work in my studio")
        self.assertEqual(story["media_type"], "image")
        self.assertEqual(response.data["count"], 1)

    def test_customer_can_like_and_comment_on_story_and_artist_is_notified(self):
        story = self.artist.studio_photos.create(
            image=self.make_photo_upload(),
            caption="At work in my studio",
        )
        self.client.force_authenticate(self.customer)

        like_response = self.client.post(reverse("artist-story-like", args=[story.id]))
        self.assertEqual(like_response.status_code, status.HTTP_200_OK)
        self.assertEqual(like_response.data, {"liked": True, "like_count": 1})
        self.assertTrue(
            ArtistStudioStoryLike.objects.filter(story=story, user=self.customer).exists()
        )
        like_notification = Notification.objects.get(
            user=self.artist_user,
            notification_type="story_like",
        )
        self.assertEqual(like_notification.data["story_id"], story.id)

        comment_response = self.client.post(
            reverse("artist-story-comments", args=[story.id]),
            {"text": "Beautiful work!"},
            format="json",
        )
        self.assertEqual(comment_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(comment_response.data["username"], self.customer.username)
        self.assertTrue(
            ArtistStudioStoryComment.objects.filter(
                story=story,
                customer=self.customer,
                text="Beautiful work!",
            ).exists()
        )
        comment_notification = Notification.objects.get(
            user=self.artist_user,
            notification_type="story_comment",
        )
        self.assertEqual(comment_notification.data["story_id"], story.id)

        feed_response = self.client.get(reverse("artist-stories"))
        self.assertEqual(feed_response.data["results"][0]["like_count"], 1)
        self.assertEqual(feed_response.data["results"][0]["comments_count"], 1)
        self.assertTrue(feed_response.data["results"][0]["liked_by_me"])

        unlike_response = self.client.post(reverse("artist-story-like", args=[story.id]))
        self.assertEqual(unlike_response.data, {"liked": False, "like_count": 0})

    def test_public_can_read_story_comments_but_must_sign_in_to_post_or_like(self):
        story = self.artist.studio_photos.create(
            image=self.make_photo_upload(),
            caption="At work in my studio",
        )

        list_response = self.client.get(reverse("artist-story-comments", args=[story.id]))
        post_response = self.client.post(
            reverse("artist-story-comments", args=[story.id]),
            {"text": "Hello"},
            format="json",
        )
        like_response = self.client.post(reverse("artist-story-like", args=[story.id]))

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 0)
        self.assertEqual(post_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(like_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_story_views_are_counted_once_per_viewer_and_artist_can_see_analytics(self):
        story = self.artist.studio_photos.create(
            image=self.make_photo_upload(),
            caption="At work in my studio",
        )
        viewer_key = "anonymous-viewer-123456"

        first_view = self.client.post(
            reverse("artist-story-view", args=[story.id]),
            {"viewer_key": viewer_key},
            format="json",
        )
        second_view = self.client.post(
            reverse("artist-story-view", args=[story.id]),
            {"viewer_key": viewer_key},
            format="json",
        )

        self.assertEqual(first_view.status_code, status.HTTP_200_OK)
        self.assertEqual(first_view.data["views_count"], 1)
        self.assertEqual(second_view.data["views_count"], 1)
        self.assertEqual(
            ArtistStudioStoryView.objects.filter(story=story).count(),
            1,
        )
        self.assertNotIn(
            "views_count",
            self.client.get(reverse("artist-stories")).data["results"][0],
        )

        self.client.force_authenticate(self.artist_user)
        analytics = self.client.get(reverse("artist-story-analytics"))
        self.assertEqual(analytics.status_code, status.HTTP_200_OK)
        self.assertEqual(analytics.data["views_count"], 1)
        self.assertEqual(analytics.data["stories"][0]["id"], story.id)
        self.assertEqual(analytics.data["stories"][0]["views_count"], 1)

        self.client.force_authenticate(self.customer)
        forbidden_analytics = self.client.get(reverse("artist-story-analytics"))
        self.assertEqual(forbidden_analytics.status_code, status.HTTP_403_FORBIDDEN)

    def test_stories_expire_from_home_feed_but_remain_in_public_studio_archive(self):
        recent_story = self.artist.studio_photos.create(
            image=self.make_photo_upload("recent-story.png"),
            caption="New story",
        )
        archived_story = self.artist.studio_photos.create(
            image=self.make_photo_upload("archived-story.png"),
            caption="Permanent archive",
        )
        ArtistStudioPhoto.objects.filter(pk=archived_story.pk).update(
            created_at=timezone.now() - timedelta(hours=25)
        )

        feed = self.client.get(reverse("artist-stories"))
        profile = self.client.get(reverse("artist-profile", args=[self.artist.pk]))

        self.assertEqual(feed.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [story["id"] for story in feed.data["results"]],
            [recent_story.id],
        )
        self.assertEqual(profile.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {story["id"] for story in profile.data["studio_photos"]},
            {recent_story.id, archived_story.id},
        )
        self.client.force_authenticate(self.artist_user)
        analytics = self.client.get(reverse("artist-story-analytics"))
        self.assertEqual(analytics.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {story["id"] for story in analytics.data["stories"]},
            {recent_story.id, archived_story.id},
        )

    def test_customer_cannot_manage_artist_studio_photos(self):
        self.client.force_authenticate(self.customer)

        list_response = self.client.get(reverse("artist-studio-photos"))
        upload_response = self.client.post(
            reverse("artist-studio-photos"),
            {"image": self.make_photo_upload()},
            format="multipart",
        )

        self.assertEqual(list_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(upload_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_artist_cannot_delete_another_artists_studio_photo(self):
        self.client.force_authenticate(self.artist_user)
        photo = self.other_artist.studio_photos.create(
            image=self.make_photo_upload("private-studio.png"),
            caption="Private",
        )

        response = self.client.delete(
            reverse("artist-studio-photo-delete", args=[photo.id])
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(self.other_artist.studio_photos.filter(pk=photo.id).exists())

    @patch("catalog.views.probe_video_duration", return_value=120.0)
    def test_artist_can_upload_and_publicly_view_studio_video(self, _probe_video):
        self.client.force_authenticate(self.artist_user)
        response = self.client.post(
            reverse("artist-studio-photos"),
            {"video": self.make_video_upload(), "caption": "Work in progress"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["media_type"], "video")
        self.assertEqual(response.data["duration_seconds"], 120)
        self.assertTrue(response.data["video"])
        self.assertIsNone(response.data["image"])

        public_response = self.client.get(reverse("artist-profile", args=[self.artist.pk]))
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.data["studio_photos"][0]["media_type"], "video")
        self.assertTrue(public_response.data["studio_photos"][0]["video"])

    @patch("catalog.views.probe_video_duration", return_value=180.1)
    def test_studio_video_longer_than_three_minutes_is_rejected(self, _probe_video):
        self.client.force_authenticate(self.artist_user)
        response = self.client.post(
            reverse("artist-studio-photos"),
            {"video": self.make_video_upload()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(self.artist.studio_photos.exists())

    @patch("catalog.views.probe_video_duration", return_value=60.0)
    def test_artist_can_upload_at_most_three_studio_videos(self, _probe_video):
        for index in range(3):
            self.artist.studio_photos.create(video=self.make_video_upload(f"studio-{index}.mp4"))
        self.client.force_authenticate(self.artist_user)

        response = self.client.post(
            reverse("artist-studio-photos"),
            {"video": self.make_video_upload("studio-extra.mp4")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.artist.studio_photos.filter(video__gt="").count(), 3)

    @patch("catalog.views.probe_video_duration", return_value=60.0)
    def test_deleting_studio_video_removes_its_file(self, _probe_video):
        self.client.force_authenticate(self.artist_user)
        upload_response = self.client.post(
            reverse("artist-studio-photos"),
            {"video": self.make_video_upload()},
            format="multipart",
        )
        video = self.artist.studio_photos.get(pk=upload_response.data["id"])
        stored_video_name = video.video.name

        response = self.client.delete(
            reverse("artist-studio-photo-delete", args=[video.pk])
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(video.video.storage.exists(stored_video_name))
