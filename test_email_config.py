#!/usr/bin/env python
"""
Script para probar la configuración de email en Django
"""

import os

import django

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.conf import settings  # noqa: E402
from django.core.mail import send_mail  # noqa: E402


def test_email_config():
    """Prueba la configuración de email"""

    print("=" * 60)
    print("PRUEBA DE CONFIGURACIÓN DE EMAIL")
    print("=" * 60)

    # Mostrar configuración actual
    print(f"\n📧 Configuración actual:")  # noqa: F541
    print(f"  EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
    print(f"  EMAIL_HOST: {settings.EMAIL_HOST}")
    print(f"  EMAIL_PORT: {settings.EMAIL_PORT}")
    print(f"  EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
    print(f"  EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
    print(f"  DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")

    # Validar configuración
    print(f"\n✓ Validación:")  # noqa: F541

    if not settings.EMAIL_HOST:
        print(f"  ✗ EMAIL_HOST no configurado")  # noqa: F541
        return False

    if not settings.EMAIL_HOST_USER:
        print(f"  ✗ EMAIL_HOST_USER no configurado")  # noqa: F541
        return False

    if not settings.EMAIL_HOST_PASSWORD:
        print(f"  ✗ EMAIL_HOST_PASSWORD no configurado")  # noqa: F541
        return False

    print(f"  ✓ EMAIL_HOST configurado")  # noqa: F541
    print(f"  ✓ EMAIL_HOST_USER configurado")  # noqa: F541
    print(f"  ✓ EMAIL_HOST_PASSWORD configurado")  # noqa: F541

    # Intentar enviar email de prueba
    print(f"\n🚀 Enviando email de prueba...")  # noqa: F541

    try:
        result = send_mail(
            subject="Prueba de Configuración - RePo-SUDOE-AI",
            message="Este es un email de prueba para verificar que la configuración SMTP funciona correctamente.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=["iker.seoane@udc.es"],
            fail_silently=False,
        )

        if result:
            print(f"  ✓ Email enviado exitosamente ({result} mensaje enviado)")
            print(
                f"\nℹ️  Revisa tu bandeja de entrada en iker.seoane@udc.es"  # noqa: F541
            )  # noqa: F541
            return True
        else:
            print(f"  ✗ No se envió el email")  # noqa: F541
            return False

    except Exception as e:
        print(f"  ✗ Error al enviar email:")  # noqa: F541
        print(f"     {type(e).__name__}: {str(e)}")
        return False


if __name__ == "__main__":
    success = test_email_config()
    print("\n" + "=" * 60)
    if success:
        print("✓ Configuración de email FUNCIONANDO")
    else:
        print("✗ Hay problemas con la configuración de email")
    print("=" * 60)
