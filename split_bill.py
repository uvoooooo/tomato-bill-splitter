import sys

class DynamicBillSplitter:
    def __init__(self):
        # We use a dictionary to track net balances of anyone mentioned
        self.net_balances = {}

    def add_bill(self, amount, payer, consumers):
        # Ensure payer is in our tracking system
        if payer not in self.net_balances:
            self.net_balances[payer] = 0.0
        
        # Ensure all consumers are in our tracking system
        for person in consumers:
            if person not in self.net_balances:
                self.net_balances[person] = 0.0

        split_amount = amount / len(consumers)
        self.net_balances[payer] += amount
        
        for person in consumers:
            self.net_balances[person] -= split_amount

    def get_settlements(self):
        debtors = []
        creditors = []

        for person, balance in self.net_balances.items():
            if balance < -0.01:
                debtors.append([person, abs(balance)])
            elif balance > 0.01:
                creditors.append([person, balance])

        settlements = []
        d_idx, c_idx = 0, 0
        while d_idx < len(debtors) and c_idx < len(creditors):
            debtor_name, d_amt = debtors[d_idx]
            creditor_name, c_amt = creditors[c_idx]
            payment = min(d_amt, c_amt)
            settlements.append(f"{debtor_name} -> {creditor_name}: {payment:.2f}")
            debtors[d_idx][1] -= payment
            creditors[c_idx][1] -= payment
            if debtors[d_idx][1] < 0.01: d_idx += 1
            if creditors[c_idx][1] < 0.01: c_idx += 1
        return settlements

def main():
    TOMATO_ART = r"""
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⣄⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠻⡶⣶⣆⣸⣸⣿⣃⣀⡀⣀⣀⠀⠀⠀⠀
    ⠀⠀⢠⠟⠋⠉⠨⣽⠯⠛⣛⠯⠺⡻⣿⣽⣒⢂⠀⠀⠀⠀
    ⠀⡨⠏⠀⠀⠀⠈⠀⠀⠀⡏⠁⠀⠀⠉⠓⠭⠉⠑⢦⠀⠀
    ⢴⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣅
    ⣸⠅⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠌
    ⠺⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡸
    ⠀⠛⢦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡞⠀
    ⠀⠀⠀⠙⠙⠮⠦⠴⠤⢤⣤⣤⣀⣤⡤⠒⠒⠉⠁⠀
    """.strip().replace("⠀", " ")

    print(TOMATO_ART)
    print("\n" + "="*40)
    print("      TOMATO BILL SPLITTER (DYNAMIC)")
    print("="*40)
    
    splitter = DynamicBillSplitter()

    while True:
        print("\n[New Bill] (Press Enter on 'Amount' to finish)")
        try:
            val = input("Amount: ").strip()
            if not val: break
            amount = float(val)

            payer = input("Who paid?: ").strip()
            if not payer: 
                print("Error: Payer cannot be empty.")
                continue

            # Show currently known people for convenience
            known_people = list(splitter.net_balances.keys())
            if payer not in known_people:
                known_people.append(payer)
            
            print(f"Consumers (Current group: {', '.join(known_people)})")
            print("  (Type names separated by space, or leave empty for EVERYONE above)")
            
            cons_input = input("> ").strip()
            if not cons_input:
                consumers = known_people
            else:
                # Split by space or comma
                consumers = [n.strip() for n in cons_input.replace(',', ' ').split() if n.strip()]

            splitter.add_bill(amount, payer, consumers)
            print(f"Recorded: {payer} paid {amount:.2f} for {', '.join(consumers)}")

        except ValueError:
            print("Invalid amount. Please try again.")

    # Final Output
    print("\n" + "═"*40)
    print("           FINAL SETTLEMENTS")
    print("═"*40)
    results = splitter.get_settlements()
    if not results:
        print(" No debts found. Everything is square!")
    else:
        for line in results:
            print(f" 💸 {line}")
    print("═"*40)
    print("Done! Have a great day!\n")

if __name__ == "__main__":
    main()