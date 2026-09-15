# 랜턴 베어러

2D 탑다운 액션 로그라이크 게임입니다. 별도의 설치나 빌드 없이 웹 브라우저에서 실행됩니다.

## GitHub Pages 배포

1. 이 폴더의 모든 파일을 GitHub 저장소에 올립니다.
2. 기본 브랜치 이름을 `main`으로 사용합니다.
3. GitHub 저장소의 **Settings → Pages**로 이동합니다.
4. **Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
5. `main` 브랜치에 파일을 푸시하면 자동으로 배포됩니다.

배포가 끝나면 Actions 실행 화면이나 Settings → Pages에서 게임 주소를 확인할 수 있습니다.

## 로컬 실행

`dist/index.html`을 브라우저로 열면 플레이할 수 있습니다. 브라우저 보안 설정 때문에 이미지가 표시되지 않는 경우에는 `dist` 폴더에서 간단한 로컬 웹 서버를 실행하세요.

## 게임 파일

- `dist/index.html`: 게임 화면
- `dist/game.js`: 게임 로직
- `dist/style.css`, `dist/extra.css`: 화면 스타일
- `dist/assets/`: 캐릭터 이미지
- `.github/workflows/deploy-pages.yml`: GitHub Pages 자동 배포 설정
