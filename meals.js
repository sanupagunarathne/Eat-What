// Demonstration catalogue: venues, prices and distances are illustrative.
export const meals = [
  {
    id: "biryani",
    name: "The golden biryani",
    venue: "Saffron Kitchen",
    cuisine: "Indian",
    price: 6000,
    distance: 1.2,
    image: "biryani.jpg",
    description: "Fragrant basmati, warming spices, and a little magic.",
    vegetarian: false,
    query: "Indian restaurant",
  },
  {
    id: "pasta",
    name: "A very good pasta",
    venue: "Little Italy",
    cuisine: "Italian",
    price: 7300,
    distance: 2.1,
    image: "pasta.jpg",
    description: "Twirl-worthy pasta. The kind worth gathering for.",
    vegetarian: true,
    query: "Italian restaurant",
  },
  {
    id: "pizza",
    name: "Pizza for the people",
    venue: "Sunday Slice",
    cuisine: "Italian",
    price: 6600,
    distance: 1.8,
    image: "pizza.jpg",
    description: "A golden crust and a table full of happy people.",
    vegetarian: true,
    query: "Pizza restaurant",
  },
  {
    id: "burger",
    name: "The proper burger",
    venue: "Bun & Co.",
    cuisine: "American",
    price: 5300,
    distance: 0.8,
    image: "burger.jpg",
    description: "A toasted bun, a juicy patty, and no regrets.",
    vegetarian: false,
    query: "Burger restaurant",
  },
  {
    id: "dosa",
    name: "Crispy golden dosa",
    venue: "The Dosa Spot",
    cuisine: "Indian",
    price: 4000,
    distance: 2.8,
    image: "dosa.jpg",
    description: "Crisp edges, comforting potato, and chutney on the side.",
    vegetarian: true,
    query: "Dosa restaurant",
  },
  {
    id: "rice",
    name: "Your comfort bowl",
    venue: "Rice & Everything",
    cuisine: "Asian",
    price: 5000,
    distance: 1.5,
    image: "rice.jpg",
    description: "A generous bowl of the good stuff. Dig in.",
    vegetarian: true,
    query: "Asian restaurant",
  },
];
export function filterMeals(filters) {
  return meals.filter(
    (m) =>
      m.price <= filters.budget &&
      m.distance <= filters.distance &&
      (!filters.vegetarian || m.vegetarian) &&
      (filters.cuisine === "Any" || m.cuisine === filters.cuisine),
  );
}
export function unanimousMatch(room) {
  if (
    !room.members.every((member) =>
      room.mealIds.every((id) => typeof member.votes[id] === "boolean"),
    )
  )
    return null;
  return (
    room.mealIds.find((id) =>
      room.members.every((member) => member.votes[id] === true),
    ) || null
  );
}
