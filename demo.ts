let message: string = "Message";
console.log(message)
// message = 10; error

// Primitive types: string, number, boolean, null, undefined, symbol, bigint
let num: number = 42;
let isActive: boolean = true;
let nullableValue: null = null;
let undefinedValue: undefined = undefined;
let bigIntValue: bigint = 9007199254741991n;
let symbolValue: symbol = Symbol("unique");

let anyValue: any = "Could be anything";
anyValue = 100; // No error

let unknownValue: unknown = "Could be anything too";
// unknownValue = unknownValue + 10; // Error

// Arrays
let numArr: number[] = [1, 2, 3, 4];
// Tuples
let tupleArr: [string, number] = ["Age", 30];

let id: string | number;
id = "Nipuna";
console.log(id)
id = 30;
// id = true; // error

// Functions
function add(num1: number, num2: number): number {
    let sum: number = num1 + num2;
    return sum;
}
let result: number = add(5, 10);
console.log(result)

const info = (name: string | number): void => {
    console.log(name)
}
info("Hari")
info(24)

// Objects
let userDetail: { name: string, age: number } = {
    name: "Nipuna",
    age: 24,
    // isActive: true // error
};
console.log(userDetail)

// Type interface
interface User {
    name: string;
    age: number;
    isActive?: boolean; // optional property
}
let user1: User = {
    name: "Hari",
    age: 24
}
console.log(user1)

// Type alias
type Point = {
    x: number;
    y: number;
    desc?: string;
}

let point1: Point = {
    x: 10,
    y: 20,
    desc: "2D space"
};
console.log(point1)

// Generics <T>
// Specify type in placeholder
function identity<T>(arg: T): T { 
    return arg;
}
let output1 = identity<string>("Hello");
let output2 = identity<number>(100);
console.log(output1, output2)

// ENUMS
enum Role {
    Admin,
    User,
    Guest
}
let userRole: Role = Role.Admin;
console.log(userRole) // index - 0
console.log(Role[userRole]) // value - Admin

interface UserDetail {
    id: number;
    name: string;
    role: Role;
}

let user2: Partial<UserDetail> = {
    role: Role.User
};
console.log(user2)

let user3: Readonly<UserDetail> = {
    id: 1,
    name: "Nipuna",
    role: Role.Admin
};
// user3.name = "New Name"; // error
console.log(user3)