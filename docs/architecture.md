# Learning Locker アーキテクチャ概要

このドキュメントは、`learninglocker` リポジトリに含まれる主要コンポーネントとデータフローを、実装コードに即してまとめたものです。

## 1. 全体像

Learning Locker は、主に以下 4 つの実行プロセスで構成されます。

- **UI Server (`ui`)**: ブラウザ向け Web アプリ配信、SSR、`/api` のリバースプロキシ
- **API Server (`api`)**: 認証、xAPI/管理 API、アップロード/ダウンロード、集計 API
- **Worker (`worker`)**: 非同期ジョブ処理（ステートメント処理、ペルソナ処理、転送、削除など）
- **Scheduler / CLI (`cli`)**: 定期実行ジョブ、運用コマンド、マイグレーション

本番運用では PM2 設定により、これらが別プロセスとして起動されます。

```mermaid
flowchart LR
  Browser[Browser]
  UI[UI Server\n(Express + SSR + Proxy)]
  API[API Server\n(Express)]
  Worker[Worker\n(Queue Subscribers)]
  Scheduler[Scheduler/CLI]
  Q[(Queue Provider\nREDIS/SQS/PUBSUB/SERVICE_BUS)]
  Mongo[(MongoDB)]
  Redis[(Redis)]
  FS[(File Storage\nlocal/S3/GCS/Azure)]
  Persona[(Persona Service)]

  Browser --> UI
  UI -->|/api proxy| API
  UI -->|static/SSR| Browser

  API --> Mongo
  API --> Redis
  API --> FS
  API -->|publish| Q

  Worker -->|subscribe| Q
  Worker --> Mongo
  Worker --> Redis
  Worker --> Persona

  Scheduler --> Redis
  Scheduler -->|enqueue/commands| Q
  Scheduler --> Mongo
```

## 2. コンポーネント詳細

### 2.1 UI Server (`ui`)

- Express ベースのサーバーで、セキュリティヘッダー (`helmet`)、圧縮 (`compression`)、アクセスログ出力を実施
- `/api` へのリクエストを API Server にプロキシ
- 静的ファイル配信と SSR（`renderApp`, `renderDashboard`）を担当

### 2.2 API Server (`api`)

- Express + Passport による認証付き API
- 主な機能
  - 認証（JWT / OAuth2 / Google OAuth）
  - xAPI ステートメント集計 API
  - REST 系リソース（persona, organisation, client, dashboard など）
  - ファイルアップロード/ダウンロード
  - 非同期処理のためのキュー投入

### 2.3 Worker (`worker`)

- 起動時に複数ハンドラを立ち上げ、キューを購読して非同期処理を実施
- 代表的な処理
  - ステートメント処理
  - persona 抽出・インポート
  - query builder cache 更新
  - statement forwarding
  - 有効期限通知
  - 組織利用量トラッキング
  - バッチ削除

### 2.4 Scheduler / CLI (`cli`)

- `scheduler` が定期ジョブを実行（例: expiration notification, org usage tracker）
- Redis ロックを使い、重複起動を抑止
- `server` コマンドで運用タスクを実行
  - DB マイグレーション
  - データ補正/移行
  - seed
  - 各種バッチ処理

## 3. データストアと外部依存

### 3.1 MongoDB

- 主データストア
- Mongoose 経由で接続（接続プール、ソケットタイムアウト設定あり）
- statements, organisations, users, dashboards, exports などの永続化

### 3.2 Redis

- キャッシュ（集計結果等）
- スケジューラの分散ロック
- キュープロバイダを REDIS/BULL にした場合のジョブ基盤

### 3.3 Queue Provider（抽象化）

`lib/services/queue` が抽象化層となり、環境変数で以下を切り替え可能。

- `REDIS` / `BULL`
- `SQS`
- `PUBSUB`
- `SERVICE_BUS`
- `LOCAL`（ローカル実装）

これにより API 側は `publish`、Worker 側は `subscribe` を同じインターフェースで利用できます。

### 3.4 File Storage

環境変数 `FS_REPO` により保存先を切り替え可能。

- `local`
- `amazon` (S3)
- `google` (GCS)
- `azure` (Blob)

ロゴやエクスポートファイル等を扱います。

## 4. 代表的なリクエスト/処理フロー

### 4.1 UI から API への通常リクエスト

1. Browser が UI Server にアクセス
2. UI Server が `/api/*` を API Server へプロキシ
3. API Server が認証・認可・バリデーションを実施
4. API Server が MongoDB/Redis へアクセスし、結果を返却

### 4.2 非同期処理（ステートメント系）

1. API Server がイベント/ジョブをキューへ publish
2. Worker が対象キューを subscribe してメッセージ受信
3. Worker ハンドラが MongoDB 更新・外部連携を実行
4. 必要に応じて dead-letter キューへ退避

### 4.3 定期バッチ処理

1. Scheduler が周期実行
2. Redis の `SET ... NX EX` でロック取得
3. 実ジョブを実行（通知メールや利用量トラッキングなど）
4. 次回実行を `setTimeout` でスケジュール

## 5. 設定の中心となる環境変数

運用時に特に重要な設定項目は以下です。

- ネットワーク
  - `UI_PORT`, `API_PORT`, `API_HOST`, `SITE_URL`
- データストア
  - `MONGODB_PATH`, `REDIS_URL`
- キュー
  - `QUEUE_PROVIDER`, `QUEUE_NAMESPACE`, 各クラウド資格情報
- ファイル保存
  - `FS_REPO` と各クラウドストレージ設定
- ログ/監視
  - `LOG_MIN_LEVEL`, `LOG_DIR`, CloudWatch 関連設定

## 6. ディレクトリ構成（要点）

- `api/src`: API ルーティング・コントローラ・認証
- `ui/src`: フロントエンド、SSR 関連、ページ/コンポーネント
- `worker/src`: キュー処理ハンドラ
- `cli/src`: 運用コマンド、スケジューラ、マイグレーション
- `lib`: 共有モデル、サービス、接続、ユーティリティ
- `pm2`: 実行プロセス定義

## 7. 運用・拡張時の観点

- **スケール戦略**
  - API と Worker を独立してスケール可能
  - キュー基盤の切り替えでクラウド環境に合わせやすい
- **可観測性**
  - コンソールログ + ローテーションログ
  - 必要に応じて CloudWatch 連携
- **安全性**
  - API 認証は Passport ベース
  - UI 側でセキュリティヘッダーを付与
- **拡張ポイント**
  - `lib/services/queue` へ新しいキュープロバイダ追加
  - Worker ハンドラ追加で非同期処理を増設
  - CLI コマンド追加で運用作業を自動化

---

必要に応じて次の段階として、

- C4 モデル（Context / Container / Component）での図式化
- シーケンス図（認証、statement ingestion、export）
- 障害対応観点（DLQ 運用、リトライ設計）

を別ドキュメントとして分離すると、チーム内共有がしやすくなります。
