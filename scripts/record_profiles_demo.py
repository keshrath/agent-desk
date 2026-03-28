"""
Agent Desk — Profiles Feature Demo

Step 1: Generate narration audio (edge-tts)
Step 2: Run Node.js Playwright script to drive Electron + capture screenshots
Step 3: Composite with ffmpeg
"""

import asyncio
import os
import subprocess
import sys

import edge_tts

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
RECORDINGS_DIR = os.path.join(PROJECT_DIR, "recordings")
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
AUDIO_DIR = os.path.join(RECORDINGS_DIR, "audio")

os.makedirs(RECORDINGS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

FFMPEG = "C:/FFMPEG/bin/ffmpeg.exe"
FFPROBE = "C:/FFMPEG/bin/ffprobe.exe"

VOICE = "en-US-AndrewMultilingualNeural"
VOICE_RATE = "-5%"

SCENES = [
    {
        "id": "intro",
        "narration": (
            "Agent Desk is your unified control center for AI coding agents. "
            "Let me show you the terminal profiles feature."
        ),
    },
    {
        "id": "open_settings",
        "narration": (
            "Open Settings from the sidebar. "
            "Scroll down to the Profiles section. "
            "Two built-in profiles are pre-configured: Default Shell and Claude."
        ),
    },
    {
        "id": "create_profile",
        "narration": (
            "Click Add Profile to create a custom one. "
            "Enter a name, the shell command, optional arguments, and a working directory. "
            "Pick an icon from the dropdown — notice the live preview. "
            "Click Add to save."
        ),
    },
    {
        "id": "launch_profile",
        "narration": (
            "Now click anywhere on the profile row, or the green play button. "
            "Agent Desk switches to the terminal view and launches a new session "
            "with that profile's command and working directory."
        ),
    },
    {
        "id": "right_click_menu",
        "narration": (
            "Profiles also appear in the context menu. "
            "Right-click the New Terminal button in the sidebar "
            "to see all your profiles listed as quick-launch options."
        ),
    },
    {
        "id": "outro",
        "narration": (
            "That's terminal profiles in Agent Desk. "
            "Create presets for any shell, tool, or AI agent — "
            "and launch them with a single click."
        ),
    },
]


def get_duration(path):
    r = subprocess.run(
        [FFPROBE, "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True,
    )
    val = r.stdout.strip()
    if val and val != "N/A":
        return float(val)
    r2 = subprocess.run(
        [FFPROBE, "-v", "quiet", "-show_entries", "stream=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True,
    )
    for line in r2.stdout.strip().split("\n"):
        line = line.strip()
        if line and line != "N/A":
            return float(line)
    r3 = subprocess.run(
        [FFPROBE, "-v", "quiet", "-count_frames", "-show_entries", "stream=nb_read_frames,r_frame_rate", "-of", "csv=p=0", path],
        capture_output=True, text=True, timeout=30,
    )
    return os.path.getsize(path) / (500 * 1024)


async def generate_audio():
    print("=== Generating narration ===")
    durations = {}
    for scene in SCENES:
        out = os.path.join(AUDIO_DIR, f"{scene['id']}.mp3")
        for attempt in range(5):
            try:
                tts = edge_tts.Communicate(scene["narration"], VOICE, rate=VOICE_RATE)
                await tts.save(out)
                break
            except Exception:
                if attempt < 4:
                    await asyncio.sleep(2)
                else:
                    raise
        dur = get_duration(out)
        durations[scene["id"]] = dur
        print(f"  {scene['id']}: {dur:.1f}s")

    concat = os.path.join(AUDIO_DIR, "concat.txt")
    with open(concat, "w") as f:
        for s in SCENES:
            f.write(f"file '{os.path.join(AUDIO_DIR, s['id'] + '.mp3').replace(chr(92), '/')}'\n")

    combined = os.path.join(AUDIO_DIR, "full_narration.mp3")
    subprocess.run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", combined], capture_output=True)
    total = get_duration(combined)
    print(f"  Total: {total:.1f}s")

    durations_js = ", ".join(f'"{k}": {v:.2f}' for k, v in durations.items())
    return durations, total, f"{{{durations_js}}}"


def run_screen_capture_and_electron(durations_json, total_dur):
    import time
    print("\n=== Launching Electron + screen capture ===")

    screen_video = os.path.join(RECORDINGS_DIR, "screen_capture.mp4")
    node_script = os.path.join(BASE_DIR, "_drive_electron.mjs")

    node_proc = subprocess.Popen(
        ["node", node_script, durations_json],
        cwd=PROJECT_DIR,
    )

    print("  Waiting for Agent Desk window...")
    time.sleep(6)

    print("  Starting ffmpeg window capture...")
    ffmpeg_proc = subprocess.Popen(
        [
            FFMPEG, "-y",
            "-f", "gdigrab", "-framerate", "25",
            "-i", "title=Agent Desk",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-movflags", "frag_keyframe+empty_moov",
            screen_video,
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )

    time.sleep(1)

    try:
        node_proc.wait(timeout=int(total_dur + 60))
    except subprocess.TimeoutExpired:
        node_proc.kill()

    time.sleep(1)

    try:
        ffmpeg_proc.stdin.write(b"q")
        ffmpeg_proc.stdin.flush()
        ffmpeg_proc.wait(timeout=10)
    except Exception:
        ffmpeg_proc.kill()

    if not os.path.exists(screen_video) or os.path.getsize(screen_video) < 1000:
        stderr = ffmpeg_proc.stderr.read().decode() if ffmpeg_proc.stderr else ""
        print(f"  WARNING: Screen capture may have failed. stderr: {stderr[:500]}")

    return screen_video, node_proc.returncode or 0


def composite(screen_video, total_dur):
    print("\n=== Compositing ===")
    narration = os.path.join(AUDIO_DIR, "full_narration.mp3")
    output = os.path.join(OUTPUT_DIR, "agent_desk_profiles_demo.mp4")

    raw_dur = get_duration(screen_video)
    trim = max(0, raw_dur - total_dur - 2)

    subprocess.run(
        [
            FFMPEG, "-y",
            "-ss", f"{trim:.2f}",
            "-i", screen_video,
            "-i", narration,
            "-t", f"{total_dur + 1:.2f}",
            "-filter_complex",
            "[0:v]setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,"
            "pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v];"
            "[1:a]aresample=44100,volume=1.2[narration]",
            "-map", "[v]", "-map", "[narration]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            output,
        ],
        check=True,
    )

    dur = get_duration(output)
    size = os.path.getsize(output) / (1024 * 1024)
    print(f"\n{'=' * 50}")
    print(f"DONE! {output}")
    print(f"Duration: {dur:.1f}s | Size: {size:.1f}MB")
    print(f"{'=' * 50}")


async def main():
    durations, total, durations_json = await generate_audio()
    screen_video, rc = run_screen_capture_and_electron(durations_json, total)
    if rc != 0:
        print(f"WARNING: Electron script exited with code {rc}")
    composite(screen_video, total)


if __name__ == "__main__":
    asyncio.run(main())
