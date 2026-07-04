# 두더지 팡!

정적 웹 두더지게임입니다. GitHub Pages로 배포할 수 있고, Supabase를 연결하면 공용 랭킹을 사용할 수 있습니다.

## 공용 랭킹 연결

1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase-setup.sql` 내용을 실행합니다.
3. Project Settings > API에서 Project URL과 anon public key를 복사합니다.
4. `config.js`에 값을 넣습니다.

```js
window.MOLE_RANKING_CONFIG = {
  supabaseUrl: "https://프로젝트ID.supabase.co",
  supabaseAnonKey: "anon-public-key",
};
```

5. GitHub에 push한 뒤 GitHub Pages를 켭니다.

`config.js` 값이 비어 있으면 공용 랭킹 대신 브라우저별 로컬 랭킹으로 동작합니다.
