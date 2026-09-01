import { useEffect, useState } from "react";

import { toMonthKey } from "../lib/dates";
import type { Task } from "../lib/types";

interface MonthSummaryPanelProps {
  month: Date;
  tasks: Record<string, Task[]>;
  summary: string;
  onSummaryChange: (text: string) => void;
}

function monthTaskCounts(tasks: Record<string, Task[]>, monthKey: string) {
  let total = 0;
  let done = 0;
  for (const [dateKey, list] of Object.entries(tasks)) {
    if (!dateKey.startsWith(monthKey)) continue;
    for (const task of list) {
      total += 1;
      if (task.done) done += 1;
    }
  }
  return { total, done, open: total - done };
}

export function MonthSummaryPanel({
  month,
  tasks,
  summary,
  onSummaryChange,
}: MonthSummaryPanelProps) {
  const monthKey = toMonthKey(month);
  const [text, setText] = useState(summary);
  const { total, done, open } = monthTaskCounts(tasks, monthKey);

  useEffect(() => {
    setText(summary);
  }, [monthKey, summary]);

  const commit = () => {
    if (text !== summary) {
      onSummaryChange(text);
    }
  };

  return (
    <section className="month-summary-panel" aria-label="本月总结">
      <div className="month-summary-stats">
        <div className="month-summary-stat">
          <span className="month-summary-stat-value">{total}</span>
          <span className="month-summary-stat-label">待办</span>
        </div>
        <div className="month-summary-stat">
          <span className="month-summary-stat-value">{done}</span>
          <span className="month-summary-stat-label">已完成</span>
        </div>
        <div className="month-summary-stat">
          <span className="month-summary-stat-value">{open}</span>
          <span className="month-summary-stat-label">未完成</span>
        </div>
      </div>
      <textarea
        className="month-summary-textarea"
        value={text}
        placeholder="记下这个月做了什么"
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
      />
    </section>
  );
}
