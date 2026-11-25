import os
import re
import shutil
import subprocess
import tempfile


class InvalidStudioVideo(ValueError):
    pass


class VideoProbeUnavailable(RuntimeError):
    pass


def _resolve_ffmpeg():
    # 1. System PATH
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    # 2. imageio-ffmpeg bundled binary
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.isfile(exe):
            return exe
    except (ImportError, OSError, RuntimeError):
        pass

    # 3. Known standard Linux locations
    for standard_path in ("/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/bin/ffmpeg"):
        if os.path.isfile(standard_path) and os.access(standard_path, os.X_OK):
            return standard_path

    return None


def probe_video_duration(uploaded_file):
    ffmpeg = _resolve_ffmpeg()
    if not ffmpeg:
        raise VideoProbeUnavailable("FFmpeg executable is unavailable on the server.")

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
            timeout=25,
            check=False,
        )
    except FileNotFoundError as exc:
        raise VideoProbeUnavailable("The FFmpeg executable could not be started.") from exc
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise InvalidStudioVideo("The video could not be inspected. Please choose another file.") from exc
    finally:
        if temporary_directory is not None:
            temporary_directory.cleanup()
        # Reset file pointer so subsequent reads/uploads get the complete file from byte 0
        try:
            uploaded_file.seek(0)
        except Exception:
            pass

    metadata = result.stderr or ""
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

