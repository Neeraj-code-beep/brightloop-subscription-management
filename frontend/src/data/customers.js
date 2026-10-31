export const CUSTOMERS = [
  { id: 'CUS-1024', name: 'Priya Sharma', contact: 'Priya Sharma', city: 'Mumbai' },
  { id: 'CUS-2001', name: 'Sharma Textiles Pvt Ltd', contact: 'Vikram Sharma', city: 'Surat' },
  { id: 'CUS-2002', name: 'Kaveri Logistics LLP', contact: 'Meenakshi Iyer', city: 'Chennai' },
  { id: 'CUS-2003', name: 'Nimbus Health Labs', contact: 'Dr. Arjun Kapoor', city: 'Bengaluru' },
  { id: 'CUS-2004', name: 'Aarav Digital Studio', contact: 'Aarav Joshi', city: 'Pune' },
  { id: 'CUS-2005', name: 'Vedanta Foods Pvt Ltd', contact: 'Neha Desai', city: 'Ahmedabad' },
  { id: 'CUS-2006', name: 'Ritu Interiors', contact: 'Ritu Malhotra', city: 'Jaipur' },
  { id: 'CUS-2007', name: 'Pinnacle Pharma Pvt Ltd', contact: 'Sanjay Reddy', city: 'Hyderabad' },
  { id: 'CUS-2008', name: 'Bhatia Agro Exports', contact: 'Harpreet Bhatia', city: 'Ludhiana' },
  { id: 'CUS-2009', name: 'Lotus Hospitality Group', contact: 'Tara Fernandes', city: 'Goa' },
  { id: 'CUS-2010', name: 'Saffron Retail Co', contact: 'Imran Qureshi', city: 'Delhi' },
  { id: 'CUS-2011', name: 'Himalaya Cold Chain Pvt Ltd', contact: 'Kunal Negi', city: 'Dehradun' },
]

export function getCustomerById(customerId) {
  return CUSTOMERS.find((customer) => customer.id === customerId)
}
