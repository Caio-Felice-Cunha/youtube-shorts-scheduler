export function createYouTubeDemoAdapter() {
  return { async process(item, context) {
    const scheduled = Boolean(item.publishAt);
    return {
      ok: true,
      id: `yt-${context.index + 1}`,
      label: item.title,
      scheduledFor: item.publishAt || null,
      steps: [
        { name: 'validate-fixture', status: 'passed', detail: `${item.file} and required metadata accepted.` },
        { name: 'simulate-upload', status: 'simulated', detail: 'A local mock acknowledged the media; no bytes were uploaded.' },
        { name: 'set-audience', status: 'passed', detail: item.madeForKids ? 'Fixture marks the audience as made for kids.' : 'Fixture marks the audience as not made for kids.' },
        { name: scheduled ? 'verify-schedule' : 'verify-visibility', status: 'passed', detail: scheduled ? `Wall-clock target ${item.publishAt} preserved.` : `Visibility would be ${item.privacy || 'public'}.` },
        { name: 'persist-resume-state', status: 'simulated', detail: 'The mock marks this fixture item complete for a resumable batch.' },
      ],
    };
  } };
}
