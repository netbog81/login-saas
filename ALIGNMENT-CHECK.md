# Verifica Allineamento Completo - Service Entity

## ✅ Database Table Structure
```sql
Table: services
- id                 (uuid, NOT NULL)
- name               (varchar, NOT NULL)
- description        (text, NULL)
- defaultDuration    (integer, NOT NULL)
- defaultPrice       (numeric, NOT NULL, default: 0)
- bufferTimeBefore   (integer, NOT NULL, default: 0)
- bufferTimeAfter    (integer, NOT NULL, default: 0)
- color              (varchar, NULL)
- isActive           (boolean, NOT NULL, default: true)
- createdAt          (timestamp, NOT NULL)
- updatedAt          (timestamp, NOT NULL)
```

## ✅ Backend Entity (service.entity.ts)
```typescript
@Entity('services')
export class Service {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field(() => Int)
  @Column()
  defaultDuration: number;

  @Field()
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  defaultPrice: number;

  @Field(() => Int)
  @Column({ default: 0 })
  bufferTimeBefore: number;

  @Field(() => Int)
  @Column({ default: 0 })
  bufferTimeAfter: number;

  @Field({ nullable: true })
  @Column({ length: 7, nullable: true })
  color?: string;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
```

## ✅ GraphQL Schema (schema.gql)
```graphql
type Service {
  id: ID!
  name: String!
  description: String
  defaultDuration: Int!
  defaultPrice: Float!
  bufferTimeBefore: Int!
  bufferTimeAfter: Int!
  color: String
  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
  appointments: [AvailabilityAppointment!]
  operators: [OperatorService!]
}
```

## ✅ Frontend Types (types.ts)
```typescript
export interface Service {
  id: string;
  name: string;
  description?: string;
  defaultDuration: number;
  defaultPrice: number;
  bufferTimeBefore: number;
  bufferTimeAfter: number;
  color?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  operatorServices?: OperatorService[];
}

export interface CreateServiceInput {
  name: string;
  description?: string;
  defaultDuration: number;
  defaultPrice?: number;
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
  color?: string;
  isActive?: boolean;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  defaultDuration?: number;
  defaultPrice?: number;
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
  color?: string;
  isActive?: boolean;
}
```

## ✅ Mutations (service.mutations.ts)
```graphql
mutation CreateService(
  $name: String!
  $description: String
  $defaultDuration: Int!
  $defaultPrice: Float
  $bufferTimeBefore: Int
  $bufferTimeAfter: Int
  $color: String
  $isActive: Boolean
) {
  createService(
    name: $name
    description: $description
    defaultDuration: $defaultDuration
    defaultPrice: $defaultPrice
    bufferTimeBefore: $bufferTimeBefore
    bufferTimeAfter: $bufferTimeAfter
    color: $color
    isActive: $isActive
  ) {
    id
    name
    description
    defaultDuration
    defaultPrice
    bufferTimeBefore
    bufferTimeAfter
    color
    isActive
    createdAt
    updatedAt
  }
}
```

## ✅ Backend Resolver (service.resolver.ts)
```typescript
async createService(
  @Args('name') name: string,
  @Args('defaultDuration', { type: () => Int }) defaultDuration: number,
  @Args('description', { nullable: true }) description?: string,
  @Args('defaultPrice', { nullable: true }) defaultPrice?: number,
  @Args('bufferTimeBefore', { type: () => Int, nullable: true }) bufferTimeBefore?: number,
  @Args('bufferTimeAfter', { type: () => Int, nullable: true }) bufferTimeAfter?: number,
  @Args('color', { nullable: true }) color?: string,
  @Args('isActive', { nullable: true }) isActive?: boolean,
): Promise<Service>
```

## ✅ Service Service (service.service.ts)
```typescript
createService(input: CreateServiceInput): Observable<Service> {
  const variables = {
    name: input.name,
    description: input.description,
    defaultDuration: input.defaultDuration,
    defaultPrice: input.defaultPrice,
    bufferTimeBefore: input.bufferTimeBefore,
    bufferTimeAfter: input.bufferTimeAfter,
    color: input.color,
    isActive: input.isActive
  };
  // ... mutation call
}
```

## Stato Allineamento

### ✅ ALLINEATO
- Database table: Tutti i campi presenti e con i tipi corretti
- Backend entity: Mappatura corretta con decoratori TypeORM e GraphQL
- GraphQL schema: Generato correttamente dal backend
- Frontend types: Interfacce allineate con il backend
- Mutations: Parametri corretti per create e update
- Resolver: Accetta tutti i parametri necessari
- Service: Invia correttamente i parametri

### Note
- Tutti i componenti della catena sono ora allineati
- Le vecchie colonne `duration` e `bufferTime` sono state rimosse dal database
- Le nuove colonne utilizzano la naming convention corretta
- I tipi sono consistenti attraverso tutta la catena