/* Endereço da API do backend.
   - Vazio (padrão): o frontend é servido pelo próprio backend (http://127.0.0.1:8000).
   - Se você abrir o frontend em outro servidor (ex.: `python -m http.server 5173`
     dentro de frontend/), troque para 'http://127.0.0.1:8000'.
   A chave da NASA NÃO fica aqui: ela fica só no backend, no arquivo .env. */
export const API_BASE = window.ATLAS_API_BASE ?? '';
