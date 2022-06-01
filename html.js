const scripts = new WeakMap();
const blocks = new Map();

function getIdForRef(ref) {
  let blockId;

  if (scripts.has(ref)) {
    blockId = scripts.get(ref);
  } else if (ref) {
    if (typeof ref === 'string') {
      ref = { src: ref };
    }

    if ('src' in ref) {
      blockId = new URL(ref.src).searchParams.get('blockId');
    } else if ('blockId' in ref) {
      blockId = ref.blockId;
    }
  }

  if (!blockId) {
    throw new Error('Block script not setup properly');
  }

  return blockId;
}

window.initBlock = (ref) => {
  const blockId = getIdForRef(ref);
  const elm = blocks.get(blockId);

  if (!elm) {
    throw new Error('Cannot find element');
  }

  return elm;
};

window.markScript = (script, ref) => {
  const blockId = getIdForRef(ref);

  if (script.type === 'module') {
    if (script.src) {
      const url = new URL(script.src);
      url.searchParams.set('blockId', blockId);
      script.src = url.toString();
    } else {
      script.innerHTML = `
      const initBlock = () => window.initBlock({ blockId: "${blockId}" });
      const markScript = (script) => window.markScript(script, { blockId: "${blockId}" });

      ${script.innerHTML};
    `;
    }
  } else {
    scripts.set(script, blockId);
  }
};

export function markBlockScripts(block) {
  const blockId = uuid();

  blocks.set(blockId, block);

  for (const script of Array.from(block.querySelectorAll('script'))) {
    markScript(script, { blockId });
  }
}
