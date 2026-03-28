#!/usr/bin/env python3
"""Generate podcast RSS feed from episodes.json."""

import json
import sys
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString


def generate_feed(episodes_path, output_path):
    with open(episodes_path) as f:
        episodes = json.load(f)

    rss = Element("rss", version="2.0")
    rss.set("xmlns:itunes", "http://www.itunes.com/dtds/podcast-1.0.dtd")
    rss.set("xmlns:content", "http://purl.org/rss/1.0/modules/content/")
    rss.set("xmlns:atom", "http://www.w3.org/2005/Atom")

    channel = SubElement(rss, "channel")

    SubElement(channel, "title").text = "Pilgrim on the Path"
    SubElement(channel, "link").text = "https://podcast.pilgrimapp.org"
    SubElement(channel, "description").text = (
        "A podcast of walks. One walker per episode. "
        "Unscripted thoughts from the path. "
        "Narrated by Dhyama voice guides."
    )
    SubElement(channel, "language").text = "en"
    SubElement(channel, "copyright").text = "Walk Talk Meditate"

    atom_link = SubElement(channel, "atom:link")
    atom_link.set("href", "https://podcast.pilgrimapp.org/feed.xml")
    atom_link.set("rel", "self")
    atom_link.set("type", "application/rss+xml")

    SubElement(channel, "itunes:author").text = "Walk Talk Meditate"
    SubElement(channel, "itunes:summary").text = (
        "A podcast of walks. One walker per episode. "
        "Unscripted thoughts from the path."
    )

    cat = SubElement(channel, "itunes:category")
    cat.set("text", "Religion & Spirituality")
    SubElement(cat, "itunes:category").set("text", "Spirituality")

    SubElement(channel, "itunes:explicit").text = "false"

    img = SubElement(channel, "itunes:image")
    img.set("href", "https://podcast.pilgrimapp.org/artwork.png")

    owner = SubElement(channel, "itunes:owner")
    SubElement(owner, "itunes:name").text = "Walk Talk Meditate"
    SubElement(owner, "itunes:email").text = "hello@walktalkmeditate.org"

    for ep in sorted(episodes, key=lambda e: e["number"], reverse=True):
        item = SubElement(channel, "item")
        SubElement(item, "title").text = ep["title"]
        SubElement(item, "description").text = ep.get("summary", "")

        guide_name = ep["guide"].capitalize()
        content_text = (
            f"Recorded in {ep['location']}. "
            f"Guided by {guide_name}. "
            f"{ep.get('summary', '')}"
        )
        SubElement(item, "content:encoded").text = content_text

        enclosure = SubElement(item, "enclosure")
        enclosure.set("url", ep["audioUrl"])
        enclosure.set("type", "audio/mpeg")
        enclosure.set("length", "0")

        ep_date = datetime.strptime(ep["date"], "%Y-%m-%d")
        SubElement(item, "pubDate").text = ep_date.strftime(
            "%a, %d %b %Y 12:00:00 +0000"
        )

        SubElement(item, "itunes:duration").text = format_duration(ep["duration"])
        SubElement(item, "itunes:author").text = "Walk Talk Meditate"
        SubElement(item, "itunes:summary").text = ep.get("summary", "")
        SubElement(item, "itunes:explicit").text = "false"

        ep_img = SubElement(item, "itunes:image")
        ep_img.set("href", "https://podcast.pilgrimapp.org/artwork.png")

        SubElement(item, "guid").text = (
            f"https://podcast.pilgrimapp.org/episode/{ep['slug']}"
        )

    xml_str = parseString(tostring(rss, encoding="unicode")).toprettyxml(
        indent="  ", encoding=None
    )
    lines = xml_str.split("\n")
    clean = "\n".join(line for line in lines if line.strip())

    with open(output_path, "w") as f:
        f.write(clean)

    print(f"Generated feed with {len(episodes)} episode(s)")


def format_duration(seconds):
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: generate-feed.py <episodes.json> <feed.xml>")
        sys.exit(1)
    generate_feed(sys.argv[1], sys.argv[2])
