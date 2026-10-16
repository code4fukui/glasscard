# glasscard

SABERAで暗記カードを連続表示するウェブアプリ

## SDK (ES modules)

- https://github.com/code4fukui/webglass-sdk

## サンプルデータ

- 電気工事士二種 https://github.com/code4fukui/denki2/blob/main/card.csv

## 起動

Web Bluetoothを使うため、`file://` ではなくローカルサーバー経由で起動します。

```sh
python3 -m http.server 8000
```

`http://localhost:8000/` をChromium系ブラウザで開き、「SABERAに接続」を押してください。SABERA接続後は、表示中のカードが自動的にSABERAの汎用テキスト画面へ送信されます。

起動時には電気工事士二種の `card.csv` をGitHub Rawから読み込みます。ネットワークに接続できない場合は内蔵サンプルに切り替わります。
