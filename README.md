# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>

## Quiz & Deck APIs

### Content Model Overview

- **Question**
  - `difficulty`: enum (`easy`, `medium`, `hard`) — required.
  - `type`: enum (`MCQ`, `RC`, `Parajumble`, `Syllogism`, `SentenceCompletion`, `Other`).
  - `group_id`: optional string to tie related items (e.g. RC sets).
  - `options`: repeatable component (`Question Option`) with `text` + `is_correct` (used for MCQs).
  - `stimulus`: optional long-form text for RC passages.
- **Adaptive Quiz Deck**
  - Stores difficulty-driven rules: `include_difficulties` (subset of `easy|medium|hard`, defaults to all three), `batch_size` (3–10), `max_questions_per_session ≥ batch_size`, and `rule_policy` (defaults to `"default-v1"`).
  - Optional metadata: `tags`, `exclusions`, `tag_logic` (`ANY`/`ALL`), `keep_groups_together`.
  - `topic` relation drives the exam/section/topic hierarchy surfaced by the API.
  - Visibility: `public`, `unlisted`, `draft` — only `public` decks are returned by `/quiz/index`.
- **Structured Quiz Deck**
  - Provides a fixed sequence of content through `ordered_items` (non-empty array of `{ kind: "question" | "group", id: number }`).
  - Shares the same `topic`, `tags`, `exclusions`, `tag_logic`, `keep_groups_together`, and `visibility` fields for consistency.
  - Contains no adaptive-only fields (difficulties, rule policy, batch size, etc.).

Admin edit forms automatically reveal adaptive-only fields (rule policy, difficulties, etc.) or structured-only fields (ordered items) based on the chosen variant.

### Public Endpoints

Both endpoints are unauthenticated and return `Cache-Control: public, max-age=60`. Set `QUIZ_API_SECRET` in your environment to allow trusted clients to request correct answers.

#### 1. Lightweight Index

```
GET /api/quiz/index?deckSlug=<slug>
```

`deckSlug` is required; the endpoint returns `404` if the deck is missing or not `public`.

Response:

```json
{
  "deck": {
    "id": 12,
    "title": "Syllogism Adaptive Drill",
    "slug": "syllogism-adaptive",
    "variant": "adaptive",
    "exam": { "name": "IBPS PO", "slug": "ibps-po" },
    "section": { "name": "Reasoning Ability", "slug": "reasoning" },
    "topic": { "id": 42, "name": "Syllogism", "slug": "syllogism" },
    "tags": [7, 9, 11],
    "tag_logic": "ANY",
    "include_difficulties": ["medium", "hard"],
    "batch_size": 5,
    "max_questions_per_session": 25,
    "rule_policy": "default-v1",
    "keep_groups_together": true,
    "exclusions": [18]
  },
  "questions": [
    { "id": 101, "difficulty": "medium", "group_id": null,   "tag_ids": [7, 14] },
    { "id": 102, "difficulty": "hard",   "group_id": "rc-42", "tag_ids": [9] }
  ]
}
```

#### 2. Fetch Questions by ID

```
GET /api/quiz/questions?ids=101,102,103
```

- Accepts up to 50 IDs per call (larger requests return `400`).
- Returns an array of render-ready questions; `X-Total-Count` reports how many matched.
- `includeAnswers=true` reveals `options[].is_correct` **only** when the request includes header `x-quiz-secret: <QUIZ_API_SECRET>`.

Response:

```json
[
  {
    "id": 101,
    "type": "MCQ",
    "difficulty": "medium",
    "group_id": null,
    "stem": "All cats are mammals...",
    "explanation": null,
    "stimulus": null,
    "options": [
      { "id": 201, "text": "All cats are pets" },
      { "id": 202, "text": "Some pets are cats" }
    ],
    "tags": [{ "id": 7, "name": "syllogism" }]
  }
]
```

Use `includeAnswers=true` with the server secret header if you need to expose `is_correct` for grading or review workflows.

### Creating Decks

- **Adaptive**: `POST /api/adaptive-quiz-decks` with payload

  ```json
  {
    "data": {
      "title": "Syllogism — Adaptive Drill",
      "slug": "syllogism-adaptive",
      "topic": 12,
      "tags": { "connect": [7, 9, 11] },
      "exclusions": { "connect": [18] },
      "include_difficulties": ["easy", "medium", "hard"],
      "batch_size": 5,
      "max_questions_per_session": 20,
      "rule_policy": "default-v1",
      "keep_groups_together": true,
      "visibility": "public"
    }
  }
  ```

- **Structured**: `POST /api/structured-quiz-decks` with payload

  ```json
  {
    "data": {
      "title": "Parajumble Practice Set",
      "slug": "parajumble-structured",
      "topic": 18,
      "ordered_items": [
        { "kind": "question", "id": 501 },
        { "kind": "group", "id": 612 }
      ],
      "keep_groups_together": true,
      "visibility": "public"
    }
  }
  ```

### Performance Notes

- Question-tag join table is indexed for fast tag-based filtering (~1–5k questions tested).
- Index endpoint paginates internally and streams all matching IDs in a single payload.
- Both endpoints apply manual caching headers; adjust `CACHE_HEADER` in the quiz controller if you need a different TTL.
- `/quiz/questions` returns `Cache-Control: public, max-age=60` and respects the 50-ID ceiling.

### Migration

Run the Strapi migrations (via `yarn develop` or `yarn strapi migrations:run`) after pulling these changes so the question/tag indexes are created.
