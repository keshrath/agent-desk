@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d "C:\Users\Mathias\.claude\apps\agent-desk"
npx electron-rebuild -f -w node-pty
echo REBUILD DONE
npx electron-builder --win dir --config.npmRebuild=false
echo BUILD DONE
