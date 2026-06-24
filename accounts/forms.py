# File location: RePo-SUDOE-AI/accounts/forms.py
from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.core.exceptions import ValidationError

from .models import AccessRequest, CustomUser, UserProfile


class CustomUserCreationForm(UserCreationForm):
    """Extended user creation form"""

    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(
            attrs={"class": "form-control", "placeholder": "Enter your email address"}
        ),
    )
    first_name = forms.CharField(
        max_length=150,
        required=True,
        widget=forms.TextInput(
            attrs={"class": "form-control", "placeholder": "First name"}
        ),
    )
    last_name = forms.CharField(
        max_length=150,
        required=True,
        widget=forms.TextInput(
            attrs={"class": "form-control", "placeholder": "Last name"}
        ),
    )
    institution = forms.CharField(
        max_length=255,
        required=True,
        widget=forms.TextInput(
            attrs={
                "class": "form-control",
                "placeholder": "University, Company, or Organization",
            }
        ),
    )
    department = forms.CharField(
        max_length=255,
        required=False,
        widget=forms.TextInput(
            attrs={
                "class": "form-control",
                "placeholder": "Department or Division (optional)",
            }
        ),
    )
    position = forms.CharField(
        max_length=255,
        required=False,
        widget=forms.TextInput(
            attrs={
                "class": "form-control",
                "placeholder": "Your position/title (e.g., PhD Student, Researcher, Professor)",
            }
        ),
    )
    research_area = forms.CharField(
        widget=forms.Textarea(
            attrs={
                "class": "form-control",
                "rows": 3,
                "placeholder": "Briefly describe your research area or field of study",
            }
        ),
        required=False,
    )
    orcid_id = forms.CharField(
        max_length=50,
        required=False,
        widget=forms.TextInput(
            attrs={
                "class": "form-control",
                "placeholder": "ORCID ID (optional, e.g., 0000-0000-0000-0000)",
            }
        ),
    )

    class Meta:
        model = CustomUser
        fields = (
            "email",
            "first_name",
            "last_name",
            "institution",
            "department",
            "position",
            "research_area",
            "orcid_id",
            "password1",
            "password2",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["password1"].widget.attrs.update(
            {"class": "form-control", "placeholder": "Create a strong password"}
        )
        self.fields["password2"].widget.attrs.update(
            {"class": "form-control", "placeholder": "Confirm your password"}
        )

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if CustomUser.objects.filter(email=email).exists():
            raise ValidationError("A user with this email already exists.")
        return email

    def clean_orcid_id(self):
        orcid_id = self.cleaned_data.get("orcid_id")
        if orcid_id:
            # Basic ORCID format validation
            import re

            pattern = r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]"
            if not re.match(pattern, orcid_id):
                raise ValidationError(
                    "Please enter a valid ORCID ID format (0000-0000-0000-0000)"
                )
        return orcid_id

    def save(self, commit=True):
        user = super().save(commit=False)
        # Auto-generate username from email
        if not user.username:
            user.username = self.cleaned_data["email"].split("@")[0]
            # Ensure uniqueness
            base_username = user.username
            counter = 1
            while CustomUser.objects.filter(username=user.username).exists():
                user.username = f"{base_username}{counter}"
                counter += 1
        if commit:
            user.save()
        return user


class AccessRequestForm(forms.ModelForm):
    """Form for requesting access to RePo-SUDOE-AI"""

    class Meta:
        model = AccessRequest
        fields = [
            "purpose",
            "project_description",
            "expected_usage",
            "supervisor_email",
            "institutional_verification",
        ]
        widgets = {
            "purpose": forms.Select(attrs={"class": "form-control"}),
            "project_description": forms.Textarea(
                attrs={
                    "class": "form-control",
                    "rows": 4,
                    "placeholder": "Please describe your project and how you plan to use RePo-SUDOE-AI."
                    " Include research objectives, methodology, and expected outcomes.",
                }
            ),
            "expected_usage": forms.Textarea(
                attrs={
                    "class": "form-control",
                    "rows": 3,
                    "placeholder": "Describe your expected usage pattern (e.g., frequency of use,"
                    " number of simulations, duration of project)",
                }
            ),
            "supervisor_email": forms.EmailInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "Supervisor or Principal Investigator email (if applicable)",
                }
            ),
            "institutional_verification": forms.Textarea(
                attrs={
                    "class": "form-control",
                    "rows": 3,
                    "placeholder": "Any additional information to verify your institutional affiliation (optional)",
                }
            ),
        }

    def clean_supervisor_email(self):
        purpose = self.cleaned_data.get("purpose")
        supervisor_email = self.cleaned_data.get("supervisor_email")

        # Require supervisor email for academic purposes
        if purpose == "academic" and not supervisor_email:
            raise ValidationError("Supervisor email is required for academic research.")

        return supervisor_email


class CustomAuthenticationForm(AuthenticationForm):
    """Custom authentication form using email instead of username"""

    username = forms.EmailField(
        widget=forms.EmailInput(
            attrs={
                "class": "form-control",
                "placeholder": "Enter your email address",
                "autofocus": True,
            }
        ),
        label="Email Address",
    )
    password = forms.CharField(
        widget=forms.PasswordInput(
            attrs={"class": "form-control", "placeholder": "Enter your password"}
        )
    )

    def clean(self):
        email = self.cleaned_data.get("username")
        password = self.cleaned_data.get("password")

        if email and password:
            self.user_cache = authenticate(
                self.request, username=email, password=password
            )
            if self.user_cache is None:
                raise ValidationError(
                    "Please enter a correct email and password. Note that both fields may be case-sensitive."
                )
            else:
                self.confirm_login_allowed(self.user_cache)

        return self.cleaned_data


class PasswordResetRequestForm(forms.Form):
    """Form for requesting password reset"""

    email = forms.EmailField(
        widget=forms.EmailInput(
            attrs={"class": "form-control", "placeholder": "Enter your email address"}
        ),
        label="Email Address",
    )

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if not CustomUser.objects.filter(email=email, is_active=True).exists():
            raise ValidationError("No active account found with this email address.")
        return email


class PasswordResetForm(forms.Form):
    """Form for resetting password with token"""

    password1 = forms.CharField(
        widget=forms.PasswordInput(
            attrs={"class": "form-control", "placeholder": "Enter new password"}
        ),
        label="New Password",
        min_length=8,
    )
    password2 = forms.CharField(
        widget=forms.PasswordInput(
            attrs={"class": "form-control", "placeholder": "Confirm new password"}
        ),
        label="Confirm Password",
    )

    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")

        if password1 and password2 and password1 != password2:
            raise ValidationError("The two password fields didn't match.")

        return password2


class ProfileUpdateForm(forms.ModelForm):
    """Form for updating user profile"""

    class Meta:
        model = CustomUser
        fields = [
            "first_name",
            "last_name",
            "institution",
            "department",
            "position",
            "research_area",
            "orcid_id",
        ]
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "form-control"}),
            "last_name": forms.TextInput(attrs={"class": "form-control"}),
            "institution": forms.TextInput(attrs={"class": "form-control"}),
            "department": forms.TextInput(attrs={"class": "form-control"}),
            "position": forms.TextInput(attrs={"class": "form-control"}),
            "research_area": forms.Textarea(attrs={"class": "form-control", "rows": 3}),
            "orcid_id": forms.TextInput(attrs={"class": "form-control"}),
        }


class ProfileAISettingsForm(forms.ModelForm):
    """Formulario para configurar el proveedor de IA y la API key del usuario."""

    api_key = forms.CharField(
        label="API Key",
        required=False,
        widget=forms.PasswordInput(
            attrs={
                "class": "form-control",
                "autocomplete": "off",
                "placeholder": "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
            },
            render_value=False,
        ),
        help_text="D\u00e9jalo en blanco para no cambiar la clave guardada. "
        "No es necesario para Ollama.",
    )
    clear_api_key = forms.BooleanField(
        label="Eliminar API key guardada",
        required=False,
        widget=forms.CheckboxInput(attrs={"class": "form-check-input"}),
    )

    class Meta:
        model = UserProfile
        fields = ["ai_provider", "ai_model", "ollama_base_url"]
        widgets = {
            "ai_provider": forms.Select(
                attrs={"class": "form-select", "id": "id_ai_provider"}
            ),
            "ai_model": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "Ej: gpt-4o-mini, claude-3-haiku-20240307, gemini-1.5-flash, llama3.1:8b",
                }
            ),
            "ollama_base_url": forms.TextInput(
                attrs={"class": "form-control", "placeholder": "http://localhost:11434"}
            ),
        }

    def clean(self):
        cleaned_data = super().clean()
        if cleaned_data.get("clear_api_key") and cleaned_data.get("api_key"):
            raise ValidationError(
                "No marques 'Eliminar API key' y a la vez introduzcas una nueva clave."
            )
        return cleaned_data


class AdminReviewForm(forms.Form):
    """Form for admin to review access requests"""

    ACTION_CHOICES = [
        ("approve", "Approve Access"),
        ("reject", "Reject Access"),
        ("request_more_info", "Request More Information"),
    ]

    action = forms.ChoiceField(
        choices=ACTION_CHOICES,
        widget=forms.RadioSelect(attrs={"class": "form-check-input"}),
    )
    admin_notes = forms.CharField(
        widget=forms.Textarea(
            attrs={
                "class": "form-control",
                "rows": 4,
                "placeholder": "Enter notes or reason for decision (required for rejection or more info requests)",
            }
        ),
        required=False,
        label="Admin Notes",
    )

    def clean(self):
        cleaned_data = super().clean()
        action = cleaned_data.get("action")
        admin_notes = cleaned_data.get("admin_notes")

        if action in ["reject", "request_more_info"] and not admin_notes:
            raise ValidationError(
                "Admin notes are required when rejecting or requesting more information."
            )

        return cleaned_data
