# Pagination and search

## Middleware

Pagination and search are both middleware. Information is stord in the `req` object.

Pagination is implemented on all GET routes. Search on most.

## Pagination

If you add a query param `page` to your request, results will be returned in pages. An optional param `pageSize` defaults to 20.

If you do the following metadata is added to the results:

```
{
  "metadata": {
    "page": 3,
    "pageSize": 20,
    "pageCount": 6,
    "totalCount": 118,
    "links": {
      "self": "/api/site/18/idea?page=3",
      "first": "/api/site/18/idea?page=0",
      "last": "/api/site/18/idea?page=5",
      "previous": "/api/site/18/idea?page=2",
      "next": "/api/site/18/idea?page=4"
    }
  },
  "records": [
    ... the results
  ]
}
```

Pagination is done in the database query. A request  asking for 20 records from a table containing 1000000 should be very fast.

But...

Search is done on the result. This is because fuzzy search is hardly available in SQL. If pagination is combined with search the pagination is of course done after the search, and no longer in the database quey.

Which means that a search could make the previosly very fast query quite expensive.

## Search

Search requests are sent as query parameter `search`, build as an object in the url:

```
?search[description]=openstad&search[title]=goed%20idee
```

A npm module like `ns` can translate nested objects automatically to such an url.

```
[
  {
    "text": "openstad"
  },
  {
    "title": "goed idee"
  }
],
```

Search is done in textfields of the object. That would e.g. be `title`, `summary` and `description` in ideas. `text` will search in all available fields.

Searching is done using the [fuzzysort](https://github.com/farzher/fuzzysort) module. This will add scores; the results are ordered by that score.

## TODO
- Testen fuzzy search: voldoet dit?
- Bepalen van de minimum score om in de resultaten terrecht te komen; wellicht configureerbaar.
- Meer zoekopties, waarschijnlijk ook dingen als zoeken op tags
