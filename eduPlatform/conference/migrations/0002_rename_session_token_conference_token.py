# Generated by Django 4.2.16 on 2024-11-19 14:07

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('conference', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='conference',
            old_name='session_token',
            new_name='token',
        ),
    ]
