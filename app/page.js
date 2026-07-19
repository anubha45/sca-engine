'use client';

import { useEffect, useRef, useState } from 'react';

function renderInlineMarkdown(text) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    parts.push(<strong key={`${match.index}-${match[1]}`}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderMarkdownContent(content) {
  if (!content) {
    return null;
  }

  const blocks = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    if (/^###\s/.test(trimmed)) {
      blocks.push(
        <h3 key={`h3-${index}`}>{renderInlineMarkdown(trimmed.replace(/^###\s/, ''))}</h3>
      );
      return;
    }

    if (/^##\s/.test(trimmed)) {
      blocks.push(
        <h2 key={`h2-${index}`}>{renderInlineMarkdown(trimmed.replace(/^##\s/, ''))}</h2>
      );
      return;
    }

    if (/^#\s/.test(trimmed)) {
      blocks.push(
        <h1 key={`h1-${index}`}>{renderInlineMarkdown(trimmed.replace(/^#\s/, ''))}</h1>
      );
      return;
    }

    if (/^[-*]\s/.test(trimmed)) {
      blocks.push(
        <li key={`li-${index}`}>{renderInlineMarkdown(trimmed.replace(/^[-*]\s/, ''))}</li>
      );
      return;
    }

    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(trimmed)}</p>);
  });

  return <div className="markdown-body">{blocks}</div>;
}

function extractAggregatedSections(content) {
  const normalized = (content || '').trim();

  if (!normalized) {
    return { evaluation: '', combined: '' };
  }

  const evaluationMatch = normalized.match(
    /##\s*Evaluation\s*([\s\S]*?)(?=##\s*Combined(?:\s+Answer)?\s*|$)/i,
  );
  const combinedMatch = normalized.match(/##\s*Combined(?:\s+Answer)?\s*([\s\S]*)$/i);

  return {
    evaluation: evaluationMatch?.[1]?.trim() || normalized,
    combined: combinedMatch?.[1]?.trim() || normalized,
  };
}

export default function Home() {
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState([]);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [aggregatedSections, setAggregatedSections] = useState({
    evaluation: '',
    combined: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAggregating, setIsAggregating] = useState(false);
  const [showAggregator, setShowAggregator] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!question.trim()) {
      setError('Please enter a question to compare the models.');
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setIsLoading(true);
    setResponses([]);
    setFinalAnswer('');
    setAggregatedSections({ evaluation: '', combined: '' });
    setError('');
    setShowAggregator(false);
    setIsAggregating(false);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question }),
      });

      const data = await response.json();
      setResponses(data.modelResults || []);
      setIsLoading(false);
      setIsAggregating(true);

      timerRef.current = setTimeout(() => {
        const answer = data.finalAnswer || 'No aggregated answer available.';
        setFinalAnswer(answer);
        setAggregatedSections(extractAggregatedSections(answer));
        setIsAggregating(false);
        setShowAggregator(true);
      }, 3000);
    } catch {
      setError('Something went wrong while generating responses.');
      setIsLoading(false);
    }
  };

  return (
    <main className="shell">
      <section className="hero-card">
        <div className="hero-text">
          <p className="eyebrow">Multi-model answer studio</p>
          <h1>Ask once. Compare three perspectives instantly.</h1>
          <p>
            Enter a prompt to see the responses from three different models, then
            view the combined answer after a short delay.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="input-group">
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask anything you want to compare..."
            rows={4}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Generating…' : 'Generate Responses'}
          </button>
        </form>

        {error ? <p className="error-message">{error}</p> : null}

        <div className="results-grid">
          {isLoading ? (
            <div className="result-card loading-card">
              <span className="model-chip">Working</span>
              <p>Gathering responses from the selected models…</p>
            </div>
          ) : null}

          {responses.map((item) => (
            <article key={item.name} className="result-card">
              <div className="model-chip">{item.name}</div>
              {renderMarkdownContent(item.output)}
            </article>
          ))}
        </div>

        {isAggregating || showAggregator ? (
          <div className="aggregator-card">
            <div className="section-title">Aggregated Answer</div>
            {isAggregating ? (
              <p>Preparing the combined response…</p>
            ) : (
              <div className="aggregator-grid">
                <div className="aggregator-box">
                  <div className="subsection-title">Evaluation</div>
                  {renderMarkdownContent(aggregatedSections.evaluation || finalAnswer)}
                </div>
                <div className="aggregator-box">
                  <div className="subsection-title">Combined</div>
                  {renderMarkdownContent(aggregatedSections.combined || finalAnswer)}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
