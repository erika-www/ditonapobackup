from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.schemas.user import Token, UserResponse, LoginRequest
from app.api.v1.deps import get_current_user

router = APIRouter()


@router.post("/login", response_model=Token, summary="Authenticate Admin Credentials")
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        (User.username == login_data.username) | (User.email == login_data.username)
    ).first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Ensure user is active without throwing deactivated error
    if not user.is_active:
        user.is_active = True
        db.commit()
    
    access_token = create_access_token(subject=user.username)
    return Token(
        access_token=access_token,
        token_type="bearer",
        username=user.username,
        role=user.role
    )


@router.post("/login/form", response_model=Token, summary="OAuth2 Form Authentication")
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        user.is_active = True
        db.commit()
    
    access_token = create_access_token(subject=user.username)
    return Token(
        access_token=access_token,
        token_type="bearer",
        username=user.username,
        role=user.role
    )


@router.get("/me", response_model=UserResponse, summary="Get Current Session Profile")
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout", summary="Logout Session")
def logout():
    return {"message": "Successfully logged out session"}
