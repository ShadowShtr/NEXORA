import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const tasks = JSON.parse(
  await readFile(new URL('../tasks/task-index.json', import.meta.url), 'utf8'),
);
const apply = process.argv.includes('--apply');

for (const task of tasks) {
  const body = [
    `**Épico:** ${task.epic}`,
    `**Dependências:** ${task.dependencies.join(', ') || 'Nenhuma'}`,
    '',
    '## Critério de aceite',
    task.acceptance,
    '',
    '## Testes',
    task.tests,
    '',
    'Consulte o ficheiro do épico e `CLAUDE.md` antes de implementar.',
  ].join('\n');

  const args = [
    'issue',
    'create',
    '--repo',
    'ltd-tech/nexora',
    '--title',
    `[${task.id}] ${task.title}`,
    '--body',
    body,
  ];
  if (!apply) {
    console.log(`gh ${args.map((arg) => JSON.stringify(arg)).join(' ')}`);
    continue;
  }

  const result = spawnSync('gh', args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!apply) console.log('\nDry run. Execute com --apply após publicar o repositório.');
