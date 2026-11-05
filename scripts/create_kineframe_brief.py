"""Generate the two-page concept brief. Requires reportlab and pypdf."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
font_root = Path(os.environ.get("KINEFRAME_FONT_DIR", "/System/Library/Fonts/Supplemental"))
pdfmetrics.registerFont(TTFont("KFRegular", str(font_root / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("KFBold", str(font_root / "Arial Bold.ttf")))
pdfmetrics.registerFontFamily("KFRegular", normal="KFRegular", bold="KFBold", italic="KFRegular", boldItalic="KFBold")
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/Kineframe_Two_Page_Brief.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(OUT), pagesize=(612, 792))
c.setTitle('Kineframe | A shared spatial workspace for human-agent engineering')
c.setAuthor('Mindscope / Kineframe')
INK = '#172840'; MUTED = '#53647B'; ACCENT = '#5967C9'
body = ParagraphStyle('body', fontName='KFRegular', fontSize=10.1, leading=14.6, textColor=HexColor(INK), spaceAfter=0)
small = ParagraphStyle('small', parent=body, fontSize=8.3, leading=11.5, textColor=HexColor(MUTED))
heading = ParagraphStyle('heading', fontName='KFBold', fontSize=11.5, leading=15, textColor=HexColor(INK))
def para(text,x,y,width=516,style=body):
    p=Paragraph(text,style);_,height=p.wrap(width,720)
    if y-height < 52: raise ValueError(f'Page overflow: {text[:45]}')
    p.drawOn(c,x,y-height);return y-height

def section(title,text,y):
    y=para(title,48,y,style=heading)-7
    return para(text,48,y)-18

def page(number,label):
    c.setFillColor(HexColor('#FAFBFD'));c.rect(0,0,612,792,fill=1,stroke=0)
    c.setFillColor(HexColor(ACCENT));c.roundRect(48,744,18,18,4,fill=1,stroke=0)
    c.setFillColor(HexColor(INK));c.setFont('KFBold',10);c.drawString(75,749,'KINEFRAME')
    c.setFont('KFRegular',8);c.setFillColor(HexColor(MUTED));c.drawRightString(564,749,label)
    c.setStrokeColor(HexColor('#DBE1EC'));c.line(48,42,564,42)
    c.setFont('KFRegular',8);c.drawString(48,27,'CONCEPT + PROTOTYPE SCOPE  /  05 NOV 2026');c.drawRightString(564,27,f'{number} / 2')
page(1,'THE PRODUCT VISION')
c.setFillColor(HexColor(INK));c.setFont('KFBold',32);c.drawString(48,694,'Build and debug,')
c.drawString(48,656,'together in space.')
y=para('A shared engineering workspace where people and AI agents talk, inspect the same live evidence, and shape software while it is being built.',48,629,style=ParagraphStyle('intro',parent=body,fontSize=13,leading=18))-23

y=section('The problem', 'Developers can delegate more work to agents, but following and steering that work can still require switching between conversations, source files, terminals, traces and dashboards. A finished answer is insufficient when a developer needs to interrupt an investigation, challenge a hypothesis or understand a fix before it runs. Kineframe explores a shared place for that collaboration.',y)
y=section('The experience', 'A developer and an agent share a persistent workspace containing the running application, its relevant source, system relationships, test evidence and proposed changes. Pointing establishes shared focus; conversation communicates intent; direct manipulation helps compare, arrange and inspect artifacts. Desktop and VR views participate in the same session. Observable actions and evidence remain distinct from hypotheses.',y)
y=section('One concrete session', '<b>1. Observe.</b> Reproduce a checkout failure and examine the actual requests and logs.<br/><b>2. Investigate.</b> The agent reads relevant files and runs checks; the developer points to a dependency and redirects it.<br/><b>3. Review.</b> A proposed patch appears alongside the failure it is intended to address.<br/><b>4. Verify.</b> Apply the reviewed change in an isolated environment, rerun the failing case and compare results.<br/><b>5. Carry context forward.</b> Keep approved preferences and engineering decisions for later sessions.',y)
y=section('Who might use it first', 'Initial customer hypotheses are developers debugging agent-generated applications, platform engineers investigating multi-service failures, and XR teams building spatial interactions. The platform ambition is broader software engineering. The first validation task is deliberately specific: jointly diagnose and fix one reproducible application bug.',y)
para('WORKING NAME  Kineframe combines movement with a shared frame of reference. Naming is provisional; this brief makes no trademark or domain-availability claim.',48,y,style=small)
c.showPage()
page(2,'HOW TO BUILD AND VALIDATE IT')
c.setFillColor(HexColor(INK));c.setFont('KFBold',25);c.drawString(48,697,'An interface for collaboration.')
y=para('A testable product thesis, with a concrete first implementation.',48,679,style=small)-20
y=section('Technical foundation', 'A session service maintains versioned source, selected artifacts, conversation, tool activity and test results. Desktop and WebXR clients render that shared state. A tool adapter connects the agent to bounded inspection, execution and patch proposals. Source edits require review; evidence is tied to the revision that produced it. Interruption, stale-change checks and rewind are core behaviors. Existing XR hardware can supply tracking; custom holographic hardware is unnecessary.',y)
y=section('Memory that users can inspect', 'Start with explicit preferences, project decisions and accepted or rejected approaches. Later, repeated corrections could suggest a preference for confirmation. Do not assume every movement reveals intent. Separate interaction calibration from project knowledge and personal preferences; provide scope, provenance, editing and deletion. Passive behavioral learning is a research direction, not an implemented feature.',y)
y=section('Prior work and the opportunity', 'The broad concept has precedents: Cursor supports visual agent instructions [1]; DreamCodeVR changes a live VR application through speech-generated code [2]; Meta provides agent-accessible XR inspection and testing [3]; SPHERE studies persistent spatial preferences [4]. Kineframe\'s proposed differentiation is the complete shared build-and-debug loop: synchronized attention, inspectable changes, interruption, verification and memory. Its productivity advantage remains to be demonstrated.',y)
y=section('What the prototype implements', 'A browser engineering workspace and WebXR room share a live session. An isolated Node service reproduces a connection leak or timeout mismatch using real HTTP requests. Bounded source patches repair those cases or add a health endpoint; review, apply, verification and rewind are supported. Activity streams as it happens. Hosted AI is optional; a labeled deterministic playbook works without a key. Voice is turn-based, memory is explicit, and headset behavior needs device testing. Arbitrary repositories, production cloud access and autonomous deployments are outside this version.',y)
y=section('Validation and business hypothesis', 'Test the same debugging task against a conventional coding-agent workflow. Measure time to a verified fix, corrective instructions, missed errors, task understanding and repeat use. Compare desktop and VR before claiming an immersion advantage. A possible business model is paid engineering seats plus execution usage, followed by team integrations. Demand, willingness to pay and retention are not yet established.',y)
refs='[1] <link href="https://cursor.com/blog/design-mode" color="#5967C9">Cursor Design Mode</link>  |  [2] <link href="https://ubiq.online/publication/dreamcodevr/Giunchi_VR2024_DreamCodeVR_preprint.pdf" color="#5967C9">DreamCodeVR, UCL</link><br/>[3] <link href="https://developers.meta.com/vr/blog/accelerate-vr-development-with-ai-and-immersive-web-sdk/" color="#5967C9">Meta Immersive Web SDK</link>  |  [4] <link href="https://arxiv.org/abs/2610.02023" color="#5967C9">SPHERE, research paper</link>'
para(refs,48,y,style=small)
c.save()
assert len(PdfReader(OUT).pages)==2
print(OUT)
