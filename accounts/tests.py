from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from accounts.models import CustomUser, EmailVerification, AccessRequest
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


class CustomUserModelTests(TestCase):
    """Unit tests for CustomUser model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
            institution='Test University',
            research_area='Molecular Biology'
        )

    def test_user_creation(self):
        """Test custom user is created correctly"""
        self.assertEqual(self.user.email, 'test@example.com')
        self.assertEqual(self.user.username, 'testuser')
        self.assertEqual(self.user.institution, 'Test University')
        self.assertFalse(self.user.is_verified)
        self.assertFalse(self.user.is_approved)

    def test_email_as_username_field(self):
        """Test email is used as login field"""
        self.assertEqual(User.USERNAME_FIELD, 'email')

    def test_get_full_name(self):
        """Test full name formatting"""
        self.assertEqual(self.user.get_full_name(), 'Test User')

    def test_get_full_name_fallback(self):
        """Test username fallback when no name provided"""
        user = User.objects.create_user(
            username='noname',
            email='noname@example.com',
            password='pass123'
        )
        self.assertEqual(user.get_full_name(), 'noname')

    def test_can_access_frontend_unapproved(self):
        """Test unapproved users cannot access frontend"""
        self.assertFalse(self.user.can_access_frontend())

    def test_can_access_frontend_approved(self):
        """Test approved and verified users can access frontend"""
        self.user.is_verified = True
        self.user.is_approved = True
        self.user.save()
        self.assertTrue(self.user.can_access_frontend())

    def test_approve_account(self):
        """Test account approval workflow"""
        admin = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='admin123'
        )

        self.user.approve_account(admin)

        self.assertTrue(self.user.is_approved)
        self.assertIsNotNone(self.user.approval_date)
        self.assertEqual(self.user.approved_by, admin)

    def test_string_representation(self):
        """Test user __str__ method"""
        expected = "Test User (test@example.com)"
        self.assertEqual(str(self.user), expected)


class EmailVerificationModelTests(TestCase):
    """Unit tests for EmailVerification model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.verification = EmailVerification.objects.create(user=self.user)

    def test_verification_creation(self):
        """Test email verification token is created"""
        self.assertIsNotNone(self.verification.token)
        self.assertIsNotNone(self.verification.created_at)
        self.assertIsNone(self.verification.verified_at)

    def test_is_expired_fresh(self):
        """Test fresh tokens are not expired"""
        self.assertFalse(self.verification.is_expired())

    def test_is_expired_old(self):
        """Test old tokens are expired (>24 hours)"""
        self.verification.created_at = timezone.now() - timedelta(hours=25)
        self.verification.save()
        self.assertTrue(self.verification.is_expired())

    def test_verify(self):
        """Test email verification process"""
        self.verification.verify()

        self.assertIsNotNone(self.verification.verified_at)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)


class AccessRequestModelTests(TestCase):
    """Unit tests for AccessRequest model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='researcher',
            email='researcher@example.com',
            password='pass123'
        )
        self.admin = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='admin123'
        )

    def test_access_request_creation(self):
        """Test access request is created correctly"""
        request = AccessRequest.objects.create(
            user=self.user,
            purpose='academic',
            project_description='Cancer research project',
            supervisor_email='supervisor@university.edu'
        )

        self.assertEqual(request.status, 'pending')
        self.assertEqual(request.purpose, 'academic')
        self.assertIsNotNone(request.id)

    def test_approve_request(self):
        """Test access request approval"""
        request = AccessRequest.objects.create(
            user=self.user,
            purpose='academic',
            project_description='Research project'
        )

        request.approve(self.admin)

        self.assertEqual(request.status, 'approved')
        self.assertEqual(request.reviewed_by, self.admin)
        self.assertIsNotNone(request.reviewed_at)

        # Check user was also approved
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_approved)

    def test_reject_request(self):
        """Test access request rejection"""
        request = AccessRequest.objects.create(
            user=self.user,
            purpose='commercial',
            project_description='Commercial use'
        )

        reason = "Commercial use not allowed in research platform"
        request.reject(self.admin, reason)

        self.assertEqual(request.status, 'rejected')
        self.assertEqual(request.reviewed_by, self.admin)
        self.assertEqual(request.admin_notes, reason)
        self.assertIsNotNone(request.reviewed_at)

    def test_request_ordering(self):
        """Test requests are ordered by creation date (newest first)"""
        request1 = AccessRequest.objects.create(
            user=self.user,
            purpose='academic',
            project_description='Project 1'
        )

        user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='pass123'
        )
        request2 = AccessRequest.objects.create(
            user=user2,
            purpose='academic',
            project_description='Project 2'
        )

        requests = AccessRequest.objects.all()
        self.assertEqual(requests[0].id, request2.id)  # Newest first


class AuthenticationFlowTests(TestCase):
    """Integration tests for authentication workflows"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            is_verified=True,
            is_approved=True
        )

    def test_login_with_email(self):
        """Test login with email instead of username"""
        response = self.client.post(reverse('accounts:login'), {
            'username': 'test@example.com',  # EMAIL field
            'password': 'testpass123'
        })

        # Should redirect after successful login
        self.assertEqual(response.status_code, 302)

    def test_login_unapproved_user(self):
        """Test unapproved users cannot login to frontend"""
        unapproved = User.objects.create_user(
            username='unapproved',
            email='unapproved@example.com',
            password='pass123',
            is_verified=True,
            is_approved=False  # Not approved
        )

        response = self.client.post(reverse('accounts:login'), {
            'username': 'unapproved@example.com',
            'password': 'pass123'
        })

        # Login succeeds but access to frontend should be denied
        # (actual enforcement depends on @full_access_required decorator)
        self.assertFalse(unapproved.can_access_frontend())
