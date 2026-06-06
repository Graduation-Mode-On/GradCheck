import type { NewsListQuery } from "./news.schemas.js";
import type { NewsRepository } from "./news.repository.js";

export async function listNewsItems(newsRepository: NewsRepository, query: NewsListQuery) {
  return newsRepository.listItems(query);
}
