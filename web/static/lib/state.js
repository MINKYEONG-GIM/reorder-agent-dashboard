export const state = {
  selectedStyleCode: null,
  searchQuery: ""
};

export function setSelectedStyleCode(styleCode) {
  state.selectedStyleCode = styleCode;
}

export function setSearchQuery(query) {
  state.searchQuery = query;
}
