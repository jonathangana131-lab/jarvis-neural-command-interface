!undef APP_FILENAME
!define APP_FILENAME "Jarvis Neural Command Interface"

!macro preInit
  SetRegView 64
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Jarvis Neural Command Interface"
!macroend

!macro customInit
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Jarvis Neural Command Interface"
!macroend
