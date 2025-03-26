# Prompt Variator

A Node.js script that generates variations of a prompt using ChatGPT API with Zod validation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy the .env.example file to .env and add your OpenAI API key:
```bash
cp .env.example .env
```

3. Edit the .env file and replace `your_openai_api_key_here` with your actual OpenAI API key.

## Usage

Edit the prompt and variators in `index.js` and run:

```bash
npm start
```

The script will generate 5 unique variations of your prompt, each targeting one of the specified aspects.
