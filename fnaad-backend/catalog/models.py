import uuid
from django.conf import settings
from django.db import models  # type: ignore
from django.core.validators import MinValueValidator  # type: ignore
from accounts.models import ArtistProfile  # type: ignore


def generate_product_slug():
    return uuid.uuid4().hex[:8]
   


class Product(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_HIDDEN = "hidden"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending review"),
        (STATUS_APPROVED, "Published"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_HIDDEN, "Hidden"),
    ]

    CATEGORY_PAINTING = "painting"
    CATEGORY_DRAWING = "drawing"
    CATEGORY_ABSTRACT = "abstract"
    CATEGORY_SCULPTURE = "sculpture"
    CATEGORY_PORTRAIT = "portrait"
    CATEGORY_HOME_DESIGN = "home_design"
    CATEGORY_CONTEMPORARY = "contemporary"
    CATEGORY_CALLIGRAPHY = "calligraphy"
    CATEGORY_ARTISAN_CRAFTS = "artisan_crafts"
    CATEGORY_HALL_OF_FAME = "hall_of_fame"
    CATEGORY_OTHER = "other"

    CATEGORY_CHOICES = [
        (CATEGORY_PAINTING, "Painting"),
        (CATEGORY_DRAWING, "Drawing"),
        (CATEGORY_ABSTRACT, "Abstract Art"),
        (CATEGORY_SCULPTURE, "Sculpture"),
        (CATEGORY_PORTRAIT, "Portrait"),
        (CATEGORY_HOME_DESIGN, "Home Design"),
        (CATEGORY_CONTEMPORARY, "Contemporary Art"),
        (CATEGORY_CALLIGRAPHY, "Calligraphy"),
        (CATEGORY_ARTISAN_CRAFTS, "Artisan Crafts"),
        (CATEGORY_HALL_OF_FAME, "Hall of Fame"),
        (CATEGORY_OTHER, "Other"),
    ]

    artist = models.ForeignKey(ArtistProfile, on_delete=models.CASCADE, related_name="products")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default=CATEGORY_OTHER)
    price_xaf = models.PositiveIntegerField(validators=[MinValueValidator(500)])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    rejection_reason = models.CharField(max_length=255, blank=True)
    is_sold = models.BooleanField(default=False)
    sold_at = models.DateTimeField(null=True, blank=True)
    public_slug = models.SlugField(max_length=20, unique=True, default=generate_product_slug)
    view_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    # Subscription visibility
    is_public_visible = models.BooleanField(default=False)
    public_visibility_expires_at = models.DateTimeField(null=True, blank=True)
    published_under_free_trial = models.BooleanField(default=False)
    # Copy tracking
    copy_of = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="derivatives")
    copy_confidence = models.FloatField(null=True, blank=True)
    flagged_as_copy = models.BooleanField(default=False)
    VERIFICATION_DECLARED = "declared"
    VERIFICATION_EVIDENCE = "evidence"
    VERIFICATION_VERIFIED = "verified"
    VERIFICATION_COLLECTOR = "collector"
    VERIFICATION_CHOICES = [(v, v.title()) for v in (VERIFICATION_DECLARED, VERIFICATION_EVIDENCE, VERIFICATION_VERIFIED, VERIFICATION_COLLECTOR)]
    CREATION_CHOICES = [(v, v.replace("_", " ").title()) for v in ("original", "commissioned", "licensed", "reproduction", "collaboration", "ai_assisted")]
    verification_level = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default=VERIFICATION_DECLARED)
    creation_method = models.CharField(max_length=20, choices=CREATION_CHOICES, default="original")
    moods = models.JSONField(default=list, blank=True)
    passport_token = models.UUIDField(default=uuid.uuid4, unique=False, editable=False, db_index=True)

    def __str__(self):
        return f"{self.title} — {self.artist.brand_name}"

    @property
    def public_url(self):
        from django.conf import settings
        from django.urls import reverse

        base_url = getattr(settings, "SITE_BASE_URL", "https://665d-51-178-86-160.ngrok-free.app").rstrip("/")
        # SITE_BASE_URL may or may not already include /api — reverse() below
        # returns the full path including /api/catalog/..., so strip any
        # trailing /api from base_url to avoid a duplicated /api/api/.
        if base_url.endswith("/api"):
            base_url = base_url[: -len("/api")]

        path = reverse("product-public-view", args=[self.public_slug])
        return f"{base_url}{path}"


class SpotlightFeature(models.Model):
    """Approval-controlled 24-hour showcase entry for a delivered artwork."""
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="spotlight_feature")
    artist_approved = models.BooleanField(default=False)
    admin_approved = models.BooleanField(default=False)
    artist_approved_at = models.DateTimeField(null=True, blank=True)
    admin_approved_at = models.DateTimeField(null=True, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ProductModerationEvent(models.Model):
    """Immutable audit trail for automated and admin moderation decisions."""
    ACTION_FLAGGED_COPY = "flagged_copy"
    ACTION_CONFIRMED_COPY = "confirmed_copy"
    ACTION_OVERRULED_COPY = "overruled_copy"
    ACTION_APPROVED = "approved"
    ACTION_REJECTED = "rejected"
    ACTION_CHOICES = [(value, value.replace("_", " ").title()) for value in (
        ACTION_FLAGGED_COPY, ACTION_CONFIRMED_COPY, ACTION_OVERRULED_COPY,
        ACTION_APPROVED, ACTION_REJECTED,
    )]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="moderation_events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class CreationEvidence(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="creation_evidence")
    evidence_file = models.FileField(upload_to="products/evidence/")
    note = models.CharField(max_length=255, blank=True)
    is_reviewed = models.BooleanField(default=False)
    approved = models.BooleanField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/")
    thumbnail = models.ImageField(upload_to="products/thumbnails/", blank=True)
    is_primary = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)
    # Image hash fields for duplicate detection
    image_phash = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    image_dhash = models.CharField(max_length=64, blank=True, null=True)
    image_file_sha256 = models.CharField(max_length=64, blank=True, null=True, db_index=True)

    class Meta:
        ordering = ["order"]
        indexes = [
            models.Index(fields=["image_file_sha256"]),
            models.Index(fields=["image_phash"]),
        ]

    def __str__(self):
        return f"Image #{self.order} — {self.product.title}"


class Conversation(models.Model):
    """
    One conversation per (product, customer) pair — lets a customer
    negotiate with the artist about a specific product.
    Also supports commission-based conversations when product is null.
    """
    STATUS_NEGOTIATING = "negotiating"
    STATUS_CONFIRMED = "confirmed"
    STATUS_DELIVERED = "delivered"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_NEGOTIATING, "Negotiating"),
        (STATUS_CONFIRMED, "Order confirmed"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="conversations", null=True, blank=True)
    commission_response = models.ForeignKey("CommissionResponse", on_delete=models.CASCADE, related_name="conversations", null=True, blank=True)
    customer = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="conversations_as_customer"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEGOTIATING)
    customer_last_read_at = models.DateTimeField(null=True, blank=True)
    artist_last_read_at = models.DateTimeField(null=True, blank=True)
    customer_typing_until = models.DateTimeField(null=True, blank=True)
    artist_typing_until = models.DateTimeField(null=True, blank=True)
    blocked_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="blocked_conversations",
    )
    is_reported = models.BooleanField(default=False)
    report_reason = models.TextField(blank=True)
    reported_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True, help_text="Set when the conversation is cancelled — lets a customer resume it instead of starting a new one.")

    class Meta:
        unique_together = [
            ["product", "customer"],
            ["commission_response", "customer"],
        ]

    def __str__(self):
        if self.product:
            return f"Conversation: {self.customer.username} ↔ {self.product.title} ({self.status})"
        return f"Commission Conversation: {self.customer.username} ↔ {self.commission_response.artist.brand_name} ({self.status})"


class Message(models.Model):
    TYPE_TEXT = "text"
    TYPE_LOCATION = "location"
    TYPE_IMAGE = "image"
    TYPE_DOCUMENT = "document"
    TYPE_AUDIO = "audio"

    TYPE_CHOICES = [
        (TYPE_TEXT, "Texte"),
        (TYPE_LOCATION, "Localisation"),
        (TYPE_IMAGE, "Image"),
        (TYPE_DOCUMENT, "Document"),
        (TYPE_AUDIO, "Audio"),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="sent_messages")
    message_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_TEXT)
    text = models.TextField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    image = models.ImageField(upload_to="messages/images/", null=True, blank=True)
    document = models.FileField(upload_to="messages/documents/", null=True, blank=True)
    audio = models.FileField(upload_to="messages/audio/", null=True, blank=True)
    # A reply always remains inside the same conversation.  The view validates
    # that boundary before saving; SET_NULL keeps a reply usable if its source
    # message is later removed.
    reply_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="replies",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_forwarded = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        if self.message_type == self.TYPE_LOCATION:
            return f"{self.sender.username}: [localisation]"
        if self.message_type == self.TYPE_IMAGE:
            return f"{self.sender.username}: [image]"
        if self.message_type == self.TYPE_DOCUMENT:
            return f"{self.sender.username}: [document]"
        return f"{self.sender.username}: {self.text[:30]}"


class MessageReaction(models.Model):
    """One current emoji reaction per user on a message.

    Sending a different emoji changes that user's reaction; sending the same
    emoji again removes it.  This keeps conversation data compact while still
    allowing the client to show grouped reaction counts.
    """

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="message_reactions")
    emoji = models.CharField(max_length=16)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("message", "user")

    def __str__(self):
        return f"{self.user.username} reacted {self.emoji} to message {self.message_id}"

class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "product")

    def __str__(self):
        return f"{self.user.username} ♥ {self.product.title}"  


class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews_written"
    )
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="review")
    rating = models.PositiveSmallIntegerField()  # 1-5
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("customer", "conversation")

    def __str__(self):
        return f"{self.customer.username} → {self.product.title}: {self.rating}★"


class CommissionRequest(models.Model):
    """
    A customer's public request for a custom artwork.
    Artists browse open requests and respond with CommissionResponse.
    """
    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_IN_PROGRESS, "In progress"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="commission_requests"
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=Product.CATEGORY_CHOICES, default=Product.CATEGORY_OTHER)
    budget_xaf = models.PositiveIntegerField(null=True, blank=True)
    region = models.CharField(max_length=20, choices=ArtistProfile.REGION_CHOICES, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} — {self.customer.username} ({self.status})"


class CommissionResponse(models.Model):
    """
    An artist expressing interest in a commission request, with a message.
    The customer sees these and reaches out to whichever artist they choose.
    """
    commission = models.ForeignKey(CommissionRequest, on_delete=models.CASCADE, related_name="responses")
    artist = models.ForeignKey(ArtistProfile, on_delete=models.CASCADE, related_name="commission_responses")
    message = models.TextField()
    proposed_price_xaf = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("commission", "artist")

    def __str__(self):
        return f"{self.artist.brand_name} → {self.commission.title}"

class SiteSettings(models.Model):
    """
    Singleton row holding global site configuration.
    Use SiteSettings.get_solo() to fetch (or auto-create) it —
    never query this model any other way.
    """
    require_product_approval = models.BooleanField(default=True)
    block_near_duplicates = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Site Settings"
        verbose_name_plural = "Site Settings"

    def __str__(self):
        return "Site Settings"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
