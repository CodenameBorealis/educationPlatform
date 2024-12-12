from django.utils.timezone import now
from django.conf import settings

from channels.layers import get_channel_layer

from celery import shared_task
from celery.exceptions import Ignore

import os
import shutil
import subprocess

from pdf2image import convert_from_path

from time import sleep

from asgiref.sync import async_to_sync
from .models import Conference


@shared_task
def end_conference(conference_token):
    # A task which is usually used as a way to end a conference when it has a set duration

    # Get the conference, set it to ended and save the end time
    conference = Conference.objects.get(token=conference_token)

    conference.ended = True
    conference.end_time = now()
    conference.celery_task_id = None

    conference.save()

    # Get the signaling server channel layer, send notification to all users and disconnect them
    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f"signaling_{conference.token}",
        {"type": "signaling_message", "message": {"type": "conference-ended"}},
    )

    async_to_sync(channel_layer.group_send)(
        f"signaling_{conference.token}",
        {"type": "end_conference"},
    )


@shared_task(bind=True)
def process_document(self, conference, document, *args, **kwargs):
    # Used for processing and converting non-pdf documents for the conference presentation

    # Gather information about the file
    basename = os.path.basename(document)
    filename, extension = os.path.splitext(basename)
    output_dir = settings.UPLOAD_DIR / f"processed_documents/{filename}"

    # Ensure that the output directory exists and is accessible
    os.makedirs(output_dir, exist_ok=True)

    # Command used to convert non-pdf files to .pdf format using libreOffice
    soffice_command = [
        "soffice.exe",
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        output_dir,
        document,
    ]
    pdf_output_path = output_dir / f"{filename}.pdf"

    # If the given document is not a .pdf file, try to convert it; if it is a .pdf file, just clone it to the output folder.
    if extension.lower() != ".pdf":
        try:
            self.update_state(state="CONVERTING", meta={"message": "Converting to .pdf"})
            subprocess.run(soffice_command, check=True)

            print("Converted file successfully")
        except subprocess.CalledProcessError as e:
            print(f"Failed to convert document {filename}, error: {e}")
            self.update_state(
                state="FAILURE", meta={"error": "Failed to convert the document."}
            )

            raise Ignore()
    else:
        shutil.copy(document, pdf_output_path)

    # Check if the converted file actually exists in the output directory, if not raise task failure
    if not os.path.exists(pdf_output_path):
        print("Unable to locate converted file.")
        self.update_state(state="FAILURE", meta={"error": "Internal server error."})

        raise Ignore()

    # Set status as processing and use pdf2image to split the .pdf file into a bunch of images
    self.update_state(state="PROCESSING", meta={"message": "Processing"})

    # Try to process the .pdf file
    try:
        images = convert_from_path(pdf_output_path, 300, timeout=60)
    except Exception as e:
        print(f"Something went wrong during .pdf processing, error: {e}")
        self.update_state(
            state="FAILURE", meta={"error": "An error occured during .pdf processing stage."}
        )
        
        raise Ignore()
    
    # Save the processed images in the output folder
    for index, image in enumerate(images):
        image.save(output_dir / f"page{index}.jpg", "JPEG")
        
    # Cleanup
    os.remove(document)
    os.remove(pdf_output_path)