# Biblioteca CECA

Catálogo online da biblioteca da Escola Casimiro de Abreu (CECA): https://bielcrod.github.io/biblioteca-CECA/

> Este catálogo **não tem todos os livros da escola**. Se um livro não aparecer aqui, ele ainda pode estar na biblioteca.

## O que o site faz

- Busca por título, autor ou assunto (funciona com ou sem acento).
- Filtro por categoria e ordem por título, autor ou ano.
- Detalhes de cada livro, com link direto: `https://bielcrod.github.io/biblioteca-CECA/?livro=ID`.
- Capa da Open Library quando o título bate; quando não acha, mostra uma capa desenhada com a cor da categoria.
- Quando o livro também está no [Ache seu Livro](https://bielcrod.github.io/ache-seu-livro/), mostra um atalho para ver livros parecidos.

## Arquivos

- `index.html`: estrutura da página.
- `styles.css`: visual (mesmo tema do Ache seu Livro).
- `app.js`: busca, filtros, capas e detalhes.
- `books-data.js`: a lista de livros.

## Como adicionar um livro

Em `books-data.js`, copie uma linha e troque os dados. Use um `id` que ainda não exista:

```js
{ id: 401, title: "Nome do livro", author: "Nome do autor", category: "Literatura Brasileira", year: 2020,
  description: "Resumo curto do livro." },
```

Categorias usadas hoje: Literatura Brasileira, Literatura Estrangeira, Clássicos, Romance, Ficção Científica, Fantasia, Biografia, Poesia, Teatro, Cordel, Quadrinhos, Infantojuvenil e Didáticos. Uma categoria nova aparece sozinha nos filtros.
