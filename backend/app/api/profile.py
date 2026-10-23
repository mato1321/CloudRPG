"""玩家檔案 / 黑市 / 劇情獎勵 / 裝備：所有會改變金幣、物品、等級的動作都在這裡由伺服器計算。"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, is_admin
from app.core.ratelimit import enforce
from app.db.database import get_db
from app.game import data as D
from app.game import economy as E
from app.game import services as S
from app.models.user import User

router = APIRouter(tags=["profile"])


class KlassReq(BaseModel):
    klass: str


class GuestImportReq(BaseModel):
    klass: str
    claims: list[str] = Field(default_factory=list)
    beatMinions: bool = False


class BuyReq(BaseModel):
    item_id: str


class ClaimReq(BaseModel):
    reward_id: str


class EquipReq(BaseModel):
    item_id: Optional[str] = None
    slot: Optional[str] = None


class SalvageReq(BaseModel):
    item_id: str


def _require_profile(db: Session, user: User, lock: bool = False):
    row = S.get_profile(db, user, lock=lock)
    if not row:
        raise HTTPException(status_code=409, detail="尚未建立角色，請先選擇職業")
    return row


def _game_error(e: E.GameError):
    raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/profile")
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = S.get_profile(db, user)
    return {
        "username": user.username,
        "isAdmin": is_admin(user),
        "profile": E.public(row.data, is_admin(user)) if row else None,
        "rating": row.rating if row else D.PVP_START_RATING,
        "towerBest": row.tower_best if row else 0,
    }


@router.post("/api/profile/create")
def create_profile(req: KlassReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if S.get_profile(db, user):
        raise HTTPException(status_code=409, detail="角色已存在")
    try:
        data = E.new_profile(req.klass)
    except E.GameError as e:
        _game_error(e)
    row = S.create_profile(db, user, data)
    return {"profile": E.public(row.data, is_admin(user))}


@router.post("/api/profile/import-guest")
def import_guest(req: GuestImportReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """訪客綁定帳號：只承認第一章可驗證的里程碑（開場補給、打倒雜魚老大），其餘由伺服器重新計算"""
    row = S.get_profile(db, user)
    if row:
        return {"profile": E.public(row.data, is_admin(user)), "imported": False}
    try:
        data = E.new_profile(req.klass)
    except E.GameError as e:
        _game_error(e)
    for cid in req.claims:
        if cid in D.STORY_REWARDS:
            E.claim_story(data, cid)
    if req.beatMinions:
        enemy = D.ENEMIES["minions"]
        E.grant_xp(data, enemy["xp"])
        data["gold"] += enemy["gold"]
        data["bossesDefeated"].append("minions")
    row = S.create_profile(db, user, data)
    return {"profile": E.public(row.data, is_admin(user)), "imported": True}


@router.post("/api/shop/buy")
def shop_buy(req: BuyReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce(f"shop:{user.id}", 30, 60)
    row = _require_profile(db, user, lock=True)
    data = S.data_of(row)
    try:
        msg = E.buy(data, req.item_id, is_admin(user))
    except E.GameError as e:
        db.rollback()
        _game_error(e)
    S.save(db, row, data)
    return {"ok": True, "msg": msg, "profile": E.public(data, is_admin(user))}


@router.post("/api/shop/transfer")
def shop_transfer(req: KlassReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce(f"shop:{user.id}", 30, 60)
    row = _require_profile(db, user, lock=True)
    data = S.data_of(row)
    try:
        msg = E.transfer_class(data, req.klass, is_admin(user))
    except E.GameError as e:
        db.rollback()
        _game_error(e)
    S.save(db, row, data)
    return {"ok": True, "msg": msg, "profile": E.public(data, is_admin(user))}


@router.post("/api/story/claim")
def story_claim(req: ClaimReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _require_profile(db, user, lock=True)
    data = S.data_of(row)
    try:
        reward = E.claim_story(data, req.reward_id)
    except E.GameError as e:
        db.rollback()
        _game_error(e)
    S.save(db, row, data)
    return {"ok": True, "reward": reward, "profile": E.public(data, is_admin(user))}


@router.post("/api/gear/equip")
def gear_equip(req: EquipReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _require_profile(db, user, lock=True)
    data = S.data_of(row)
    try:
        E.equip(data, req.item_id, req.slot)
    except E.GameError as e:
        db.rollback()
        _game_error(e)
    S.save(db, row, data)
    return {"ok": True, "profile": E.public(data, is_admin(user))}


@router.post("/api/gear/salvage")
def gear_salvage(req: SalvageReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _require_profile(db, user, lock=True)
    data = S.data_of(row)
    try:
        gold = E.salvage(data, req.item_id)
    except E.GameError as e:
        db.rollback()
        _game_error(e)
    S.save(db, row, data)
    return {"ok": True, "gold": gold, "profile": E.public(data, is_admin(user))}
