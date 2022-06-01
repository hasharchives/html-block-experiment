import { renderBlock } from './render-block';

renderBlock(`
  <button id="button">Get Random Number</button>
  <script type="module">
  import { BlockDummyHandler } from "./services/block-dummy.js";
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
  <script type="module" src="${new URL('./blocks/green.js', import.meta.url)}">
  </script>
`);

renderBlock(`
  Yellow
  <script src="${new URL('./blocks/yellow.js', import.meta.url)}">
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
    script.src = "${new URL('./blocks/purple.js', import.meta.url)}";
    markScript(script);
    initBlock().appendChild(script);
  </script>
`);

renderBlock(new URL('./blocks/pink.html', import.meta.url));
