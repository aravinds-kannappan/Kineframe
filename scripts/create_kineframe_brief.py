"""Create the two-page visual concept brief with vector diagrams.

Requires reportlab and pypdf. KINEFRAME_FONT_DIR can override the Arial directory.
"""
from pathlib import Path
import math
import os
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/Kineframe_Two_Page_Brief.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
font_root = Path(os.environ.get("KINEFRAME_FONT_DIR", "/System/Library/Fonts/Supplemental"))
for name, file in [("KF", "Arial.ttf"), ("KFBold", "Arial Bold.ttf")]:
    pdfmetrics.registerFont(TTFont(name, str(font_root / file)))
pdfmetrics.registerFontFamily("KF", normal="KF", bold="KFBold", italic="KF", boldItalic="KFBold")
c = canvas.Canvas(str(OUT), pagesize=(612, 792))
c.setTitle("Kineframe | Build and debug, together in space")
c.setAuthor("Mindscope / Kineframe")
INK = "#172840"
MUTED = "#5B6A80"
VIOLET = "#6658D3"
TEAL = "#1C826E"
LINE = "#DDE3ED"
WHITE = "#FFFFFF"


def box(x, y, w, h, fill, stroke=None, radius=10):
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=bool(stroke))


def text(value, x, y, size=10, color=INK, bold=False):
    c.setFont("KFBold" if bold else "KF", size)
    c.setFillColor(HexColor(color))
    c.drawString(x, y, value)


def para(value, x, top, w, size=10, leading=None, color=INK, bold=False, bottom=49):
    style = ParagraphStyle("p", fontName="KFBold" if bold else "KF", fontSize=size,
                           leading=leading or size * 1.4, textColor=HexColor(color))
    p = Paragraph(value, style)
    _, height = p.wrap(w, 720)
    if top - height < bottom:
        raise ValueError(f"Text overflow: {value[:50]}")
    p.drawOn(c, x, top - height)
    return top - height


def arrow(x1, y1, x2, y2, color=VIOLET, both=False):
    c.setStrokeColor(HexColor(color))
    c.setLineWidth(1.25)
    c.line(x1, y1, x2, y2)
    angle = math.atan2(y2 - y1, x2 - x1)
    for x, y, a in [(x2, y2, angle)] + ([(x1, y1, angle + math.pi)] if both else []):
        c.line(x, y, x - 4 * math.cos(a - .5), y - 4 * math.sin(a - .5))
        c.line(x, y, x - 4 * math.cos(a + .5), y - 4 * math.sin(a + .5))


def page(number, label):
    c.setFillColor(HexColor("#FAFBFD"))
    c.rect(0, 0, 612, 792, fill=1, stroke=0)
    box(48, 743, 19, 19, VIOLET, radius=5)
    c.setStrokeColor(HexColor(WHITE))
    c.setLineWidth(1.4)
    c.line(54, 748, 54, 757)
    c.line(54, 752, 61, 757)
    c.line(54, 752, 61, 748)
    text("KINEFRAME", 76, 748, 10, bold=True)
    c.setFont("KF", 8)
    c.setFillColor(HexColor(MUTED))
    c.drawRightString(564, 748, label)
    c.setStrokeColor(HexColor(LINE))
    c.setLineWidth(.7)
    c.line(48, 43, 564, 43)
    text("CONCEPT + PROTOTYPE  /  05 NOV 2026", 48, 28, 7.5, MUTED)
    text("kineframe.onrender.com", 414, 28, 7.5, VIOLET)
    c.linkURL("https://kineframe.onrender.com", (414, 25, 500, 37), relative=0)
    c.setFillColor(HexColor(MUTED))
    c.drawRightString(564, 28, f"{number} / 2")


page(1, "THE SHARED WORKSPACE")
text("Build and debug,", 48, 692, 36, bold=True)
text("together in space.", 48, 650, 36, bold=True)
para("You and an AI agent inhabit the same engineering workspace. Talk, point, inspect what changes, and verify the result together.",
     48, 626, 500, 13, 18)

# Diagram 1: the collaboration model, not a screenshot or a product claim.
box(48, 326, 516, 240, "#172840", radius=16)
text("ONE CONVERSATION. THE SAME LIVE EVIDENCE.", 68, 543, 8.6, "#BEB5FF", True)
box(64, 391, 96, 111, "#263A53", radius=9)
text("HUMAN", 78, 481, 10, WHITE, True)
para("Point & ask<br/>Redirect work<br/>Review changes", 78, 464, 77, 9, 16, "#D5DEED", bottom=392)
box(452, 391, 96, 111, "#263A53", radius=9)
text("AI AGENT", 463, 481, 10, WHITE, True)
para("Inspect source<br/>Propose fixes<br/>Run checks", 463, 464, 79, 9, 16, "#D5DEED", bottom=392)
box(180, 371, 252, 149, "#EEEAFE", radius=10)
text("SHARED ROOM", 196, 497, 10, "#4D3EA0", True)
for x, y, title, caption in [(196, 436, "Application", "What it does"), (310, 436, "Source", "What is built"),
                              (196, 388, "Traces & tests", "What happened"), (310, 388, "Proposed patch", "What will change")]:
    box(x, y, 106, 41, WHITE, radius=5)
    text(title, x + 8, y + 25, 8.6, INK, True)
    text(caption, x + 8, y + 11, 7.8, MUTED)
arrow(161, 446, 179, 446, "#C8BEFF", both=True)
arrow(433, 446, 451, 446, "#C8BEFF", both=True)
text("Shared focus", 75, 376, 7.7, "#BEB5FF")
text("Visible actions", 453, 376, 7.7, "#BEB5FF")
text("Desktop first  /  WebXR room  /  No custom holographic hardware", 84, 345, 9.2, "#D5DEED")

text("From a failure to a verified fix", 48, 297, 14, bold=True)
para("Chat, code and logs are often separate. Kineframe brings the investigation into one place, so the developer can understand and steer work while it happens.", 48, 280, 516, 10.2, 14)
# Diagram 2: an actual example with a feedback path.
labels = [("01", "Reproduce", "Checkout fails"), ("02", "Investigate", "Trace the leak"),
          ("03", "Review", "Inspect the diff"), ("04", "Apply", "Repair source"), ("05", "Verify", "Rerun requests")]
for i, (num, label, caption) in enumerate(labels):
    x = 48 + i * 105
    box(x, 165, 96, 68, "#FFFFFF", LINE, radius=8)
    text(num, x + 10, 214, 8, VIOLET, True)
    text(label, x + 10, 196, 10, bold=True)
    text(caption, x + 10, 181, 7.8, MUTED)
    if i < 4:
        arrow(x + 97, 199, x + 103, 199)
c.setStrokeColor(HexColor(VIOLET))
c.setLineWidth(.9)
c.line(516, 164, 516, 151)
c.line(516, 151, 201, 151)
arrow(201, 151, 201, 164)
text("If checks fail, return to the evidence", 267, 137, 8.2, VIOLET)
text("FIRST USERS", 48, 107, 8, VIOLET, True)
for x, title, copy in [(48, "App developers", "Debug agent-built software"),
                        (225, "Platform engineers", "Investigate service failures"),
                        (402, "XR teams", "Build spatial experiences")]:
    text(title, x, 87, 10, bold=True)
    text(copy, x, 71, 8.3, MUTED)
c.showPage()

page(2, "THE SYSTEM + THE PRODUCT THESIS")
text("A room with a working engine.", 48, 698, 25, bold=True)
para("Spatial interaction is the interface. Versioned actions and real execution make the collaboration useful.", 48, 679, 500, 12, 17)

# Diagram 3: architecture and explicit memory boundary.
text("HOW A SESSION WORKS", 48, 620, 8.5, VIOLET, True)
for x, w, title, lines, color in [
    (48, 128, "INTERFACES", "Browser workspace<br/>WebXR room<br/>Voice or typed intent", "#EEF0FA"),
    (218, 176, "SHARED SESSION", "Selected artifact + dialogue<br/>Versioned source + patch<br/>Streamed activity + evidence", "#EEEAFE"),
    (436, 128, "EXECUTION", "Agent tool adapter<br/>Isolated Node service<br/>Real HTTP checks", "#E9F4EF"),
]:
    box(x, 493, w, 105, color, radius=9)
    text(title, x + 12, 577, 9, INK, True)
    para(lines, x + 12, 562, w - 23, 8.7, 16, MUTED, bottom=497)
arrow(178, 548, 216, 548, both=True)
arrow(396, 548, 434, 548, both=True)
text("intent", 185, 560, 7.2, MUTED)
text("actions", 401, 560, 7.2, MUTED)
text("state", 185, 532, 7.2, MUTED)
text("results", 402, 532, 7.2, MUTED)
arrow(306, 491, 306, 478, both=True)
box(48, 429, 516, 48, "#FFFFFF", LINE, radius=8)
text("MEMORY YOU CONTROL", 62, 456, 8.5, TEAL, True)
para("Save, edit or forget explicit preferences. Learning from repeated behavior is a future research direction, with user confirmation.", 226, 464, 322, 8.6, 12, MUTED, bottom=431)

# Scope columns deliberately distinguish shipped behavior from ambition.
for x, fill, accent, title in [(48, "#E9F4EF", TEAL, "WORKING PROTOTYPE"), (314, "#F1EFF9", VIOLET, "NEXT TO PROVE")]:
    box(x, 227, 250, 180, fill, radius=10)
    text(title, x + 14, 385, 8.8, accent, True)
para("<b>A real, bounded debugging loop.</b><br/>Reproduce a connection leak or timeout, inspect a proposed source patch, apply it, verify with HTTP requests, and rewind.<br/><br/>Shared activity, explicit memory and turn-based voice. Optional hosted AI; a labeled playbook runs without an API key.",
     62, 368, 221, 9.5, 13.6, bottom=236)
para("<b>Broader software engineering.</b><br/>Connect arbitrary repositories and infrastructure. Add deeper tool integrations, durable team sessions and confirmed behavioral preferences.<br/><br/>Test headset ergonomics and real-time conversation. Productivity gains and customer demand remain unproven.",
     328, 368, 221, 9.5, 13.6, bottom=236)
text("THE VALIDATION PLAN", 48, 206, 8.5, VIOLET, True)
para("Compare the same debugging task in a conventional agent workflow, Kineframe desktop and VR. Measure time to a verified fix, missed errors, understanding and repeat use. A possible business model is engineering seats plus execution usage.",
     48, 191, 516, 9.5, 13.5)
text("THE OPPORTUNITY", 48, 118, 8.5, VIOLET, True)
para("Visual agents and voice-driven VR coding already exist. The thesis is a complete shared build-and-debug loop: attention, intervention, review, verification and inspectable memory.",
     48, 104, 516, 9, 12)
para('Precedents: <link href="https://cursor.com/blog/design-mode" color="#6658D3">Cursor Design Mode</link> / '
     '<link href="https://ubiq.online/publication/dreamcodevr/Giunchi_VR2024_DreamCodeVR_preprint.pdf" color="#6658D3">DreamCodeVR</link> / '
     '<link href="https://developers.meta.com/vr/blog/accelerate-vr-development-with-ai-and-immersive-web-sdk/" color="#6658D3">Meta Immersive Web SDK</link> / '
     '<link href="https://arxiv.org/abs/2610.02023" color="#6658D3">SPHERE</link>. Working name is provisional.',
     48, 71, 516, 7.1, 10)
c.save()
reader = PdfReader(OUT)
assert len(reader.pages) == 2
assert all(len(p.extract_text()) > 500 for p in reader.pages)
print(f"{OUT} ({len(reader.pages)} pages)")
