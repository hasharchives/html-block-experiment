import { EmbedderDummyHandler } from './services/embedder-dummy';
import { markBlockScripts } from './html';

export function renderBlock(html) {
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
