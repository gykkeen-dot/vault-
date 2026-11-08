#!/bin/sh
# Usage: sheet.sh <frames-dir> <out.png> [cols=3]
# Crops each frame to the video area and tiles them into one contact sheet, so a whole video is one image to read.
d="$1"; out="$2"; cols="${3:-3}"
n=$(ls "$d"/frame-*.png | wc -l); rows=$(( (n + cols - 1) / cols ))
ffmpeg -y -loglevel error -pattern_type glob -i "$d/frame-*.png" \
  -vf "crop=430:590:0:56,scale=300:-1,tile=${cols}x${rows}:padding=4:color=white" -frames:v 1 "$out"
