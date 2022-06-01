import { EmbedderDummyHandler } from './embedder-dummy';

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

function markBlockScripts(block) {
  const blockId = uuid();

  blocks.set(blockId, block);

  for (const script of Array.from(block.querySelectorAll('script'))) {
    markScript(script, { blockId });
  }
}

function renderBlock(html) {
  const frag = document.createRange().createContextualFragment(html);
  const parent = document.createElement('div');
  parent.append(frag);

  new EmbedderDummyHandler({
    callbacks: {
      getRandomNumber: () => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (Math.random() > 0.9) {
              resolve({
                errors: [
                  {
                    message: 'RandomError',
                    code: 'ERRROR',
                  },
                ],
              });
            } else {
              resolve({ payload: Math.round(Math.random() * 100) });
            }
          }, 500);
        });
      },
    },
    element: parent,
  });

  markBlockScripts(parent);

  document.getElementById('app').append(parent);
}

renderBlock(`
  <button id="button">Get Random Number</button>
  <script type="module">
  import { BlockDummyHandler } from "./block-dummy.js";
  const elm = initBlock();
  const service = new BlockDummyHandler({ element: elm });

  elm.querySelector("#button").addEventListener("click", evt => {
    const button = evt.currentTarget;
    const prevValue = button.innerText;
    button.innerText = "Loading…";
    button.disabled = true;

    service.getRandomNumber().then(res => {
      
      const para = document.createElement("p");

      para.innerText = res.errors?.[0]?.message ?? res.payload;

      elm.appendChild(para);

    }).finally(() => {
      button.innerText = prevValue;
      button.disabled = false;
    })

  });

  elm.style.color = "red";
  </script>
`);

renderBlock(`
  Blue
  <script type="module">
  const elm = initBlock();
  elm.style.color = "blue";
  </script>
`);

renderBlock(`
  Green
  <script type="module" src="${new URL('./green.js', import.meta.url)}">
  </script>
`);

renderBlock(`
  Yellow
  <script src="${new URL('./yellow.js', import.meta.url)}">
  </script>
`);

renderBlock(`
  Orange
  <script>
  initBlock(document.currentScript).style.color = "orange";
  </script>
`);

renderBlock(`
  <span id="color" style="text-transform:capitalize;"></span>
  <script type="module">
  const colors = ["red", "green", "blue", "yellow", "orange"];

  let i = 0;
  const handler = () => {
    const span = initBlock().querySelector("#color");
    span.style.color = colors[i];
    span.innerText = colors[i];
    i = (i + 1) % colors.length;
  };
  handler();
  setInterval(handler, 1_000);
  </script>
`);

renderBlock(`
  Purple
  <script type="module">
    const script = document.createElement("script");
    script.type = "module";
    script.src = "${new URL('./purple.js', import.meta.url)}";
    markScript(script);
    initBlock().appendChild(script);
  </script>
`);
