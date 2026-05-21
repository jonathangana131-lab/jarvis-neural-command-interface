!undef APP_FILENAME
!define APP_FILENAME "Jarvis Neural Command Interface"

!macro preInit
  SetRegView 64
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Jarvis Neural Command Interface"
!macroend

!macro customInit
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Jarvis Neural Command Interface"
!macroend

!macro customInstall
  CreateShortCut "$DESKTOP\${APP_FILENAME}.lnk" "$INSTDIR\${APP_FILENAME}.exe" "" "$INSTDIR\resources\app\build\icon.ico"
  CreateShortCut "$SMPROGRAMS\${APP_FILENAME}.lnk" "$INSTDIR\${APP_FILENAME}.exe" "" "$INSTDIR\resources\app\build\icon.ico"
!macroend
