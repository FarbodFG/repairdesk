from django.core.validators import RegexValidator

validate_phone_number = RegexValidator(
    regex=r'^09\d{9}$',
    message='Phone number must be 11 digits and start with 09. Example: 09121234567.',
    code='invalid_phone_number',
)
