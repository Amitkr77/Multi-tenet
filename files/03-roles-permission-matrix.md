# User Roles & Permission Matrix

## Multi-Tenant SaaS Commerce Platform

---

## 1. Role Hierarchy

```
Platform Level
  └── Super Admin

Tenant Level
  └── Owner
  └── Admin
  └── Manager
  └── Staff (custom scoped roles supported)

Store Level
  └── Customer
```

- **Super Admin**: platform operator, manages all tenants, plans, and global settings.
- **Owner**: the tenant account creator; full control within their tenant, including billing and team management.
- **Admin**: full operational control within a tenant, minus billing/ownership transfer.
- **Manager**: operational control over day-to-day commerce (products, orders, inventory), no team/role management.
- **Staff**: limited access based on assigned custom role/permission set.
- **Customer**: storefront-facing account, no dashboard access.

Permissions are **not hardcoded** — Owners/Admins can create custom roles by combining permissions from the matrix below. The table shows the default configuration.

---

## 2. Platform-Level Permissions

| Action | Super Admin |
|---|:---:|
| View/search all tenants | ✅ |
| Suspend / reactivate / offboard tenant | ✅ |
| View platform-wide analytics | ✅ |
| Create / edit subscription plans | ✅ |
| View cross-tenant audit logs | ✅ |
| Impersonate tenant admin (support) | ✅ |
| Configure global platform settings | ✅ |
| Override tenant plan limits | ✅ |

---

## 3. Tenant-Level Permission Matrix

Legend: **C** = Create, **R** = Read, **U** = Update, **D** = Delete, **—** = No access

| Module | Owner | Admin | Manager | Staff (default) |
|---|:---:|:---:|:---:|:---:|
| **Team & Roles** | | | | |
| Invite / remove staff | CRUD | CRUD | — | — |
| Assign roles | CRUD | CRUD | — | — |
| Create custom roles | CRUD | CRUD | — | — |
| **Billing & Subscription** | | | | |
| View plan & usage | R | R | R | — |
| Change plan | CRUD | — | — | — |
| View/download invoices | R | R | — | — |
| Connect payment account (Stripe Connect) | CRUD | CRUD | — | — |
| **Store Settings** | | | | |
| Store profile / branding | CRUD | CRUD | R | — |
| Custom domain setup | CRUD | CRUD | — | — |
| **Products** | | | | |
| Products / categories / brands / attributes | CRUD | CRUD | CRUD | R |
| Variants | CRUD | CRUD | CRUD | R |
| Bulk import/export | CRUD | CRUD | CRUD | — |
| **Inventory** | | | | |
| View stock | R | R | R | R |
| Adjust stock | CRUD | CRUD | CRUD | U (limited) |
| Low-stock alert config | CRUD | CRUD | R | — |
| **Orders** | | | | |
| View orders | R | R | R | R (assigned only, optional) |
| Update order status / fulfillment | CRUD | CRUD | CRUD | U |
| Issue refunds | CRUD | CRUD | R (request only) | — |
| **Customers** | | | | |
| View customer profiles | R | R | R | R |
| Edit customer records | CRUD | CRUD | CRUD | U |
| Segment / tag customers | CRUD | CRUD | CRUD | — |
| **Coupons & Promotions** | | | | |
| Manage coupons | CRUD | CRUD | CRUD | — |
| **Shipping & Tax** | | | | |
| Configure shipping zones/rates | CRUD | CRUD | R | — |
| Configure tax rules | CRUD | CRUD | R | — |
| **Reviews** | | | | |
| Moderate reviews | CRUD | CRUD | CRUD | R |
| **Analytics & Reports** | | | | |
| View dashboards | R | R | R | R (limited) |
| Export reports | R | R | R | — |
| **Audit Logs** | | | | |
| View tenant audit log | R | R | — | — |
| **Notifications Settings** | | | | |
| Configure notification types | CRUD | CRUD | — | — |

---

## 4. Store-Level (Customer) Permissions

| Action | Customer |
|---|:---:|
| Register / log in | ✅ |
| Browse products | ✅ |
| Manage own cart | ✅ |
| Place order / checkout | ✅ |
| View own order history | ✅ |
| Manage own addresses | ✅ |
| Leave reviews on purchased products | ✅ |
| Access other customers' data | ❌ |
| Access tenant dashboard | ❌ |

---

## 5. Permission Model Notes

- Permissions are stored as granular capability strings, e.g. `products.create`, `orders.refund`, `billing.manage`.
- Roles are collections of permissions; users are assigned one or more roles within a tenant.
- Every API endpoint checks permissions server-side via a guard — client-side role checks are UI convenience only, never a security boundary.
- Custom "Staff" sub-roles (e.g., "Fulfillment Staff", "Support Staff") are built by selecting a subset of permissions from this matrix, not by modifying code.
- Permission checks are always evaluated **within the authenticated user's active tenant context** — a user with a role in Tenant A has zero implicit access to Tenant B, even with the same role name.
