// Array of quote objects
let quotes = [
  { text: "The only way to do great work is to love what you do.", category: "Motivation" },
  { text: "In the middle of every difficulty lies opportunity.", category: "Inspiration" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", category: "Perseverance" }
];

// Get references to DOM elements
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");

// Function to show a random quote
function showRandomQuote() {
  // Clear previous content
  quoteDisplay.innerHTML = "";

  // Select a random quote
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const randomQuote = quotes[randomIndex];

  // Create DOM elements dynamically
  const quoteText = document.createElement("p");
  quoteText.textContent = `"${randomQuote.text}"`;
  quoteText.style.fontSize = "18px";
  quoteText.style.fontStyle = "italic";

  const quoteCategory = document.createElement("p");
  quoteCategory.textContent = `— Category: ${randomQuote.category}`;
  quoteCategory.style.color = "gray";

  // Append new elements to the display
  quoteDisplay.appendChild(quoteText);
  quoteDisplay.appendChild(quoteCategory);
}

// Function to add a new quote
function addQuote() {
  const quoteInput = document.getElementById("newQuoteText");
  const categoryInput = document.getElementById("newQuoteCategory");

  const newQuoteText = quoteInput.value.trim();
  const newQuoteCategory = categoryInput.value.trim();

  if (!newQuoteText || !newQuoteCategory) {
    alert("Please fill out both fields!");
    return;
  }

  // Create a new quote object and add it to the array
  const newQuote = { text: newQuoteText, category: newQuoteCategory };
  quotes.push(newQuote);

  // Clear input fields
  quoteInput.value = "";
  categoryInput.value = "";

  // Notify user and show the new quote immediately
  alert("New quote added successfully!");
  showRandomQuote();
}

// Function to dynamically create the "Add Quote" form and handle new quote input
function createAddQuoteForm() {
  // Create a form container
  const formContainer = document.createElement("div");
  formContainer.style.marginTop = "20px";
  formContainer.style.borderTop = "1px solid #ccc";
  formContainer.style.paddingTop = "10px";

  // Create and style form elements
  const title = document.createElement("h3");
  title.textContent = "Add a New Quote";
  formContainer.appendChild(title);

  const quoteInput = document.createElement("input");
  quoteInput.type = "text";
  quoteInput.placeholder = "Enter a new quote";
  quoteInput.style.marginRight = "10px";
  formContainer.appendChild(quoteInput);

  const categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.placeholder = "Enter quote category";
  categoryInput.style.marginRight = "10px";
  formContainer.appendChild(categoryInput);

  const addButton = document.createElement("button");
  addButton.textContent = "Add Quote";
  formContainer.appendChild(addButton);

  // Event listener for adding quotes
  addButton.addEventListener("click", () => {
    const newText = quoteInput.value.trim();
    const newCategory = categoryInput.value.trim();

    if (!newText || !newCategory) {
      alert("Please fill in both fields!");
      return;
    }

    // Create a new quote object and add it to the array
    const newQuote = { text: newText, category: newCategory };
    quotes.push(newQuote);

    // Clear the input fields
    quoteInput.value = "";
    categoryInput.value = "";

    alert("New quote added successfully!");
  });

  // Append the form to the body
  document.body.appendChild(formContainer);
}

// Event listener for showing a random quote
newQuoteBtn.addEventListener("click", showRandomQuote);

// Show an initial quote when the page loads
showRandomQuote();

// Dynamically create the "Add Quote" form on load
createAddQuoteForm();