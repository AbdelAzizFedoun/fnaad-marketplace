import os
import re
import subprocess
import tempfile


class InvalidStudioVideo(ValueError):
    pass


class VideoProbeUnavailable(RuntimeError):
    pass


def probe_video_duration(uploaded_file):
    try:
        import imageio_ffmpeg

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, OSError, RuntimeError) as exc:
        raise VideoProbeUnavailable("The bundled FFmpeg executable is unavailable.") from exc

    if not os.path.isfile(ffmpeg):
        raise VideoProbeUnavailable("The bundled FFmpeg executable is missing.")

    temporary_directory = None
    try:
        try:
            video_path = uploaded_file.temporary_file_path()
        except AttributeError:
            temporary_directory = tempfile.TemporaryDirectory()
            suffix = os.path.splitext(uploaded_file.name)[1]
            video_path = os.path.join(temporary_directory.name, f"studio-upload{suffix}")
            with open(video_path, "wb") as target:
                for chunk in uploaded_file.chunks():
                    target.write(chunk)

        result = subprocess.run(
            [
                ffmpeg,
                "-hide_banner",
                "-i",
                video_path,
                "-frames:v",
                "0",
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except FileNotFoundError as exc:
        raise VideoProbeUnavailable("The bundled FFmpeg executable could not be started.") from exc
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise InvalidStudioVideo("The video could not be inspected. Please choose another file.") from exc
    finally:
        if temporary_directory is not None:
            temporary_directory.cleanup()

    metadata = result.stderr
    if "Video:" not in metadata:
        raise InvalidStudioVideo("The selected file does not contain a readable video stream.")

    match = re.search(r"Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)", metadata)
    if not match:
        raise InvalidStudioVideo("The video duration could not be read.")

    hours, minutes, seconds = match.groups()
    duration = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    if duration <= 0:
        raise InvalidStudioVideo("The video must have a duration greater than zero.")
    return duration
