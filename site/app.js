const summary = document.querySelector('#summary');
const items = document.querySelector('#items');
const run = document.querySelector('#run');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function statistic(value, label) {
  const card = element('article');
  card.append(element('strong', '', value), element('span', '', label));
  return card;
}

async function replay() {
  run.disabled = true;
  run.textContent = 'Replaying…';
  try {
    const response = await fetch('./demo-report.json');
    if (!response.ok) throw new Error('report returned ' + response.status);
    const report = await response.json();
    summary.replaceChildren(
      statistic(report.summary.simulated + '/' + report.summary.total, 'items simulated'),
      statistic(report.summary.externalWrites, 'external writes'),
      statistic(report.mode, 'execution mode'),
    );
    items.replaceChildren();
    report.items.forEach((item, index) => {
      const card = element('article', 'item');
      const head = element('div');
      head.append(element('span', 'number', String(index + 1).padStart(2, '0')), element('h3', '', item.label), element('span', 'status', item.status));
      const schedule = item.scheduledFor ? 'Scheduled: ' + item.scheduledFor : 'Immediate visibility path';
      const steps = element('ol');
      item.steps.forEach((step) => {
        const row = element('li');
        row.append(element('b', '', step.name), element('span', '', step.detail));
        steps.append(row);
      });
      card.append(head, element('p', 'schedule', schedule), steps);
      items.append(card);
    });
  } catch (error) {
    summary.replaceChildren(element('p', '', 'Report unavailable: ' + error.message));
  } finally {
    run.disabled = false;
    run.textContent = 'Replay again';
  }
}

run.addEventListener('click', replay);
replay();
