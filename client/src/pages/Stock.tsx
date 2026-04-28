/**
 * Stock — fully managed by Safi AI
 */
import { Package } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "What's my current stock level?",
  "Show anything running low",
  "Add a new stock item — numbing cream, 20 units",
  "I've received 10 new syringes — update the stock",
  "Used 5 cannulas today — log that",
  "What stock items do I have from my supplier?",
];

const SECTION_CONTEXT = `You are in the Stock section — managing product inventory and stock levels.

What you can do here:
- List all stock items with quantities (use get_stock_full tool — no approval needed for reading)
- Check low stock alerts (use get_stock_full with low_stock_only: true)
- Add new stock items (use add_stock_item tool)
- Record stock movements — deliveries in and items used/sold out (use update_stock_quantity tool)

Stock movement types:
- "in" = received a delivery / restocked
- "out" = used, sold, or consumed

APPROVAL REQUIRED before any write action:

Before adding a new stock item:
"I'm about to add this to your stock:
- Item: [name]
- Category: [category]
- Starting quantity: [qty] [unit]
- Low stock alert at: [threshold]
- Cost price: £[cost] per [unit]
Shall I go ahead?"

Before recording a stock movement:
"I'm about to log this:
- Item: [name]
- Movement: [+qty / -qty] [unit] ([in/out])
- Notes: [reason]
Current stock will change from [current] to [new].
Shall I go ahead?"

Only call add_stock_item or update_stock_quantity after the user confirms.
After any stock update, confirm the new quantity clearly.
When showing stock, always flag ⚠️ LOW items prominently at the top.`;

export default function Stock() {
  return (
    <SafiSectionChat
      section="Stock"
      description="Safi manages your inventory and stock levels"
      icon={<Package className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
