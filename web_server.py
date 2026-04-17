"""
Simple web UI for Tomato Bill Splitter. Run: uvicorn web_server:app --reload
"""

import os
import tempfile
import uuid
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from split_bill import DynamicBillSplitter, write_session_output_file

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"

sessions: dict[str, DynamicBillSplitter] = {}


def get_splitter(session_id: str) -> DynamicBillSplitter:
    if session_id not in sessions:
        sessions[session_id] = DynamicBillSplitter()
    return sessions[session_id]


def state_payload(splitter: DynamicBillSplitter) -> dict:
    return {
        "balances": {k: round(v, 2) for k, v in sorted(splitter.net_balances.items())},
        "history": splitter.history,
        "known_people": splitter.known_people,
    }


class AddBillBody(BaseModel):
    amount: float = Field(gt=0)
    payer: str
    consumers: list[str] = []


app = FastAPI(title="Tomato Bill Splitter")

app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")


@app.get("/")
def index():
    return FileResponse(WEB_DIR / "index.html")


@app.get("/api/state")
def api_state(session_id: str = Query(..., min_length=1)):
    s = get_splitter(session_id)
    return state_payload(s)


@app.post("/api/bill")
def api_add_bill(body: AddBillBody, session_id: str = Query(..., min_length=1)):
    payer = body.payer.strip()
    if not payer:
        raise HTTPException(status_code=400, detail="Payer name is required.")

    s = get_splitter(session_id)
    people = list(s.known_people)
    if payer not in people:
        people.append(payer)

    consumers = [c.strip() for c in body.consumers if c.strip()]
    if not consumers:
        consumers = list(people)

    if not consumers:
        raise HTTPException(status_code=400, detail="At least one consumer is required.")

    s.add_bill(body.amount, payer, consumers)
    return state_payload(s)


@app.delete("/api/bill/{bill_id}")
def api_delete_bill(bill_id: int, session_id: str = Query(..., min_length=1)):
    s = get_splitter(session_id)
    if not s.delete_bill(bill_id):
        raise HTTPException(status_code=404, detail="Bill not found.")
    return state_payload(s)


@app.post("/api/reset")
def api_reset(session_id: str = Query(..., min_length=1)):
    sessions[session_id] = DynamicBillSplitter()
    return state_payload(sessions[session_id])


@app.get("/api/settlements")
def api_settlements(session_id: str = Query(..., min_length=1)):
    s = get_splitter(session_id)
    rows = []
    for debtor, creditor, amount in s.get_settlements():
        rows.append({"from": debtor, "to": creditor, "amount": round(amount, 2)})
    return {"items": rows}


@app.get("/api/export.xlsx")
def api_export(
    background_tasks: BackgroundTasks,
    session_id: str = Query(..., min_length=1),
):
    s = get_splitter(session_id)
    settlements = s.get_settlements()
    fd, tmp_path = tempfile.mkstemp(suffix=".xlsx", prefix="tomato_bill_")
    os.close(fd)
    path = Path(tmp_path)
    path.unlink()
    write_session_output_file(s, settlements, path=path)
    stamp = uuid.uuid4().hex[:8]
    background_tasks.add_task(lambda p=path: p.unlink(missing_ok=True))
    return FileResponse(
        path,
        filename=f"tomato_bill_session_{stamp}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
