# ErgStats

**Talk to Claude or ChatGPT about your Concept2 workouts.**

I train on a Concept2, and every workout I do ends up in my Concept2 Logbook. After a while I wanted to ask questions about all that data the way I'd ask a coach: how my pacing held up on a hard piece, whether my steady state is getting easier, how much I've actually trained this month. My AI assistant was great at answering questions like that, but it had no way to see my workouts. So I built ErgStats to connect the two.

ErgStats links your Concept2 Logbook to the AI assistant you already use. You sign in once with your Concept2 account, and from then on your assistant can read your workouts, splits, heart rate and personal bests, and talk them through with you in plain language. I made it for myself first, and I've opened it up so anyone with a Logbook account can use it too.

**[www.ergstats.com](https://www.ergstats.com)**

## What you can ask

Once it's connected, just ask the way you normally would:

- "How did my pacing hold up on yesterday's 2k?"
- "How many meters did I row each week this block?"
- "Am I getting faster at 5k?"
- "Set my heart rate zones from my profile."

It works with RowErg, SkiErg and BikeErg workouts, whether they synced from ErgData, came straight off your monitor, or were logged by hand.

## Getting started

1. Go to [www.ergstats.com](https://www.ergstats.com) and pick the setup guide for your assistant. There are guides for Claude, ChatGPT, Claude Code, Codex, Cursor and VS Code.
2. Add `https://www.ergstats.com/mcp` as a connector.
3. Sign in with Concept2 when your assistant asks, and start asking.

There's no password to share, no token to copy and nothing to install.

## Your data

ErgStats only reads your workouts. It can't add, change or delete anything in your Logbook. You can disconnect an app at any time from your dashboard, and deleting your account erases your data from ErgStats straight away (backups and hosting logs keep a copy until they expire on their own). The [privacy policy](https://www.ergstats.com/privacy) has the details, and since all of the code is right here under the MIT license, you can check for yourself.

## Questions and feedback

I'd love to hear how you're using it, or what you wish it could do. Email me at [hi@chrsep.dev](mailto:hi@chrsep.dev) or [open an issue](https://github.com/chrsep/ergstats/issues). If you find a security problem, please email me instead of opening a public issue.

ErgStats is an independent project. It isn't affiliated with or endorsed by Concept2.

## For developers

Under the hood, ErgStats is a hosted [MCP](https://modelcontextprotocol.io) server built with Next.js, Better Auth and Drizzle on Neon Postgres, and deployed on Vercel. To run it locally you need Node 22+, pnpm and a Postgres database:

```sh
pnpm install
cp .env.example .env.local   # fill in the values
pnpm db:migrate
pnpm dev
```

You don't need real Concept2 credentials: `node scripts/fake-concept2.ts` stands in for the Logbook with sample workouts. How sign-in works, what each tool returns, the checks to run before pushing and how to deploy are all in [docs/development.md](docs/development.md).
